// quick-video — page server dashboard (Bun).
let R: typeof import("renderer");
try {
  R = await import("/usr/local/bin/ob-plugin-quick-video-renderer.ts");
} catch {
  R = await import("../render/renderer.ts");
}
import * as fs from "node:fs";

const PORT = Number(process.env.OPEN_BOT_PAGE_PORT ?? 4747);
const TOKEN = process.env.OPEN_BOT_PAGE_TOKEN ?? "";

// Une seule règle : token exact exigé dès qu'un vrai token est configuré.
// Sans token (ou en preview runtime, token littéral "dev-preview"), la page
// est ouverte — c'est le mode développement explicite, jamais un backdoor :
// en production le dashboard et les /hooks injectent toujours le vrai token.
function authorized(req: Request): boolean {
  if (!TOKEN || TOKEN === "dev-preview") return true;
  return req.headers.get("x-open-bot-page-token") === TOKEN;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function fail(e: unknown, status = 400): Response {
  return json({ error: e instanceof Error ? e.message : String(e) }, status);
}

// ---- jobs (dashboard) ----

interface Job {
  id: string;
  template: string;
  format: string;
  status: "queued" | "rendering" | "done" | "failed";
  created_at: string;
  finished_at?: string;
  video_path?: string;
  file_size_bytes?: number;
  warnings?: string[];
  error?: { code: string; message: string; hint?: string; details?: string[] };
}

const jobsFile = (): string => `${R.dataDir()}/jobs.json`;

function loadJobs(): Job[] {
  try {
    return JSON.parse(fs.readFileSync(jobsFile(), "utf8")) as Job[];
  } catch {
    return [];
  }
}

function saveJobs(jobs: Job[]): void {
  try {
    fs.mkdirSync(R.dataDir(), { recursive: true });
    fs.writeFileSync(jobsFile(), JSON.stringify(jobs.slice(0, 20), null, 1));
  } catch {
    // ignore
  }
}

const running = new Set<string>();

function startJob(input: R.RenderInput, format: string): Job {
  const job: Job = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    template: String(input.template),
    format,
    status: "queued",
    created_at: new Date().toISOString(),
  };
  const jobs = loadJobs();
  jobs.unshift(job);
  // au démarrage du serveur, un vieux job "queued/rendering" est mort : marqué failed au premier reload
  for (const j of jobs) {
    if (j !== job && (j.status === "queued" || j.status === "rendering")) {
      j.status = "failed";
      j.error = { code: "INTERRUPTED", message: "Rendu interrompu (redémarrage du serveur de page)." };
    }
  }
  saveJobs(jobs);
  running.add(job.id);
  void (async () => {
    job.status = "rendering";
    bump(job);
    const res = await R.renderVideo(input);
    job.finished_at = new Date().toISOString();
    if (res.ok) {
      job.status = "done";
      job.video_path = res.video_path;
      job.file_size_bytes = res.file_size_bytes;
      job.warnings = res.warnings;
    } else {
      job.status = "failed";
      job.error = res.error;
    }
    bump(job);
    running.delete(job.id);
  })().catch((e) => {
    job.status = "failed";
    job.error = { code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
    bump(job);
    running.delete(job.id);
  });
  return job;
}

function bump(job: Job): void {
  const jobs = loadJobs();
  const i = jobs.findIndex((j) => j.id === job.id);
  if (i >= 0) jobs[i] = { ...job };
  else jobs.unshift(job);
  saveJobs(jobs);
}

// ---- UI : bundle figé (OPEN_BOT_PAGE_UI) ou checkout inline ----

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" };

function withToken(html: string): string {
  const safe = TOKEN.replace(/[^A-Za-z0-9._-]/g, "");
  return html.replace(/__QV_TOKEN__/g, () => safe);
}

async function checkoutUiRoutes(): Promise<Record<string, unknown> | null> {
  try {
    const [jsBuild, html, css] = await Promise.all([
      Bun.build({ entrypoints: [new URL("./app.ts", import.meta.url).pathname], target: "browser" }),
      Bun.file(new URL("./index.html", import.meta.url).pathname).text(),
      Bun.file(new URL("./styles.css", import.meta.url).pathname).text(),
    ]);
    const js = (await jsBuild.outputs[0].text()).replace(/<\/script/gi, "<\\/script");
    const inlined = html
      .replace(/<link rel="stylesheet" href="\.?\/?styles\.css">/, () => `<style>\n${css}\n</style>`)
      .replace(/<script src="\.?\/?app\.ts"><\/script>/, () => `<script type="module">\n${js}\n</script>`);
    if (inlined === html) return null;
    return {
      "/": (): Response => new Response(withToken(inlined), { headers: HTML_HEADERS }),
    };
  } catch {
    return null;
  }
}

const routes: Record<string, unknown> = process.env.OPEN_BOT_PAGE_UI
  ? {
      "/": async (): Promise<Response> =>
        new Response(withToken(await Bun.file(process.env.OPEN_BOT_PAGE_UI as string).text()), {
          headers: HTML_HEADERS,
        }),
    }
  : (await checkoutUiRoutes()) ?? {
      "/": async (): Promise<Response> => {
        const mod = await import("./index.html");
        return new Response(withToken(await new Response(mod.default.body).text()), { headers: HTML_HEADERS });
      },
    };

async function readBodyJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const pageServer = Bun.serve({
  port: PORT,
  routes: routes as never,
  async fetch(req): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/healthz") return new Response("ok");

    if (!authorized(req)) return json({ error: "unauthorized" }, 403);

    if (req.method === "GET" && path === "/api/templates") {
      const engine = R.engineStatus();
      return json({ templates: R.listTemplates(), engine, busy: R.isBusy() });
    }

    if (req.method === "POST" && path === "/api/renders") {
      try {
        const body = await readBodyJson(req);
        const options = (body.options ?? {}) as Record<string, unknown>;
        const input: R.RenderInput = {
          template: String(body.template ?? ""),
          text: String(body.text ?? ""),
          options: {
            format: options.format === "9:16" ? "9:16" : "16:9",
            theme: options.theme === "light" ? "light" : "dark",
            accent: typeof options.accent === "string" ? options.accent : undefined,
            params: (options.params ?? {}) as Record<string, unknown>,
            audio_path: typeof options.audio_path === "string" ? options.audio_path : undefined,
          },
        };
        const v = R.validateRender(input);
        if (!v.ok) return json(v, 400);
        const fmt = String((v.props as { format?: string }).format ?? "16:9");
        if (R.isBusy() && running.size > 0) {
          return json({ error: "Un rendu est déjà en cours — réessaie dans quelques minutes." }, 409);
        }
        const job = startJob(input, fmt);
        return json({ id: job.id, status: job.status }, 202);
      } catch (e) {
        return fail(e);
      }
    }

    if (req.method === "GET" && path === "/api/renders") {
      const jobs = loadJobs();
      return json({ jobs: jobs.slice(0, 20) });
    }

    const m = /^\/api\/renders\/([0-9a-z-]+)(\/video)?$/.exec(path);
    if (m) {
      const job = loadJobs().find((j) => j.id === m[1]);
      if (!job) return fail("rendu introuvable", 404);
      if (m[2] === "/video") {
        if (job.status !== "done" || !job.video_path) return fail("vidéo non disponible", 409);
        const file = Bun.file(job.video_path);
        if (!(await file.exists())) return fail("fichier supprimé du workspace", 404);
        return new Response(file, { headers: { "content-type": "video/mp4", "cache-control": "no-cache" } });
      }
      return json(job);
    }

    return json({ error: "not found" }, 404);
  },
});
