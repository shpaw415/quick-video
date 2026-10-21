// quick-video — bibliothèque de rendu partagée (Bun).
// Frontière stricte : ce fichier n'importe JAMAIS remotion. Le moteur vit dans
// /opt/quick-video/remotion et est piloté par subprocess Node (npx remotion render).
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";

export const PLUGIN_ID = "quick-video";

// ---- chemins ----

export function engineDir(): string {
  return process.env.QUICK_VIDEO_ENGINE_DIR ?? "/opt/quick-video/remotion";
}

export function stateDir(): string {
  return process.env.QUICK_VIDEO_STATE_DIR ?? "/home/agent/.open-bot/plugin-quick-video";
}

export function dataDir(): string {
  return process.env.QUICK_VIDEO_DATA_DIR ?? "/home/agent/.open-bot/pages-data/quick-video";
}

function registryPath(): string {
  // Installé à plat : ob-plugin-quick-video-registry.json à côté de ce fichier.
  return process.env.QUICK_VIDEO_REGISTRY ?? `${import.meta.dir}/ob-plugin-quick-video-registry.json`;
}

function settingsPath(): string {
  return process.env.QUICK_VIDEO_CONFIG ?? `/home/agent/.config/open-bot/plugin-${PLUGIN_ID}.json`;
}

// ---- registre (source unique de vérité) ----

export interface ParamDef {
  key: string;
  type: "string" | "enum" | "string[]";
  required?: boolean;
  maxlen?: number;
  item_maxlen?: number;
  min_items?: number;
  max_items?: number;
  options?: string[];
  default?: string;
  label: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  duration_s: number | null;
  duration_formula?: string;
  text_param: string;
  text_label: string;
  text_maxlen: number;
  params: ParamDef[];
}

export interface Registry {
  version: number;
  fps: number;
  sizes: Record<string, [number, number]>;
  templates: TemplateDef[];
}

export function registry(): Registry {
  return JSON.parse(fs.readFileSync(registryPath(), "utf8")) as Registry;
}

export function getTemplate(id: string): TemplateDef | undefined {
  return registry().templates.find((t) => t.id === id);
}

// ---- configuration ----

export interface Config {
  output_dir: string;
  render_timeout_s: number;
  default_format: string;
}

export function config(): Config {
  let settings: Record<string, unknown> = {};
  try {
    settings = (JSON.parse(fs.readFileSync(settingsPath(), "utf8")) as { settings?: Record<string, unknown> }).settings ?? {};
  } catch {
    // pas encore de réglages : défauts
  }
  const str = (k: string, env: string, def: string): string => String(process.env[env] ?? settings[k] ?? def);
  const num = (k: string, env: string, def: number): number => {
    const v = Number(process.env[env] ?? settings[k] ?? def);
    return Number.isFinite(v) && v > 0 ? v : def;
  };
  return {
    output_dir: str("output_dir", "QUICK_VIDEO_OUTPUT_DIR", "/home/agent/workspace/quick-video"),
    render_timeout_s: num("render_timeout_s", "QUICK_VIDEO_TIMEOUT_S", 900),
    default_format: str("default_format", "QUICK_VIDEO_FORMAT", "16:9"),
  };
}

// ---- erreurs ----

export type ErrorCode =
  | "TEMPLATE_NOT_FOUND"
  | "INVALID_PARAMS"
  | "ENGINE_NOT_INSTALLED"
  | "BROWSER_MISSING"
  | "RENDER_TIMEOUT"
  | "RENDER_FAILED"
  | "RENDER_EMPTY_OUTPUT"
  | "RENDER_BUSY"
  | "OUTPUT_DIR_UNWRITABLE"
  | "INTERNAL";

export interface RenderError {
  ok: false;
  error: { code: ErrorCode; message: string; hint?: string; details?: string[] };
}
export interface RenderOk {
  ok: true;
  video_path: string;
  template: string;
  format: string;
  resolution: { width: number; height: number };
  duration_s: number | null;
  file_size_bytes: number;
  warnings: string[];
}

export type RenderResult = RenderOk | RenderError;

function err(code: ErrorCode, message: string, hint?: string, details?: string[]): RenderError {
  return { ok: false, error: { code, message, hint, details } };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// ---- validation ----

export interface RenderInput {
  template: string;
  text: string;
  options?: {
    format?: string;
    theme?: string;
    accent?: string;
    params?: Record<string, unknown>;
    audio_path?: string;
  };
}

/** Valide l'entrée SANS rien rendre. Retourne le template et les props résolus. */
export function validateRender(
  input: RenderInput,
): { ok: true; template: TemplateDef; props: Record<string, unknown>; warnings: string[] } | RenderError {
  const reg = registry();
  const t = getTemplate(input?.template ?? "");
  if (!t) {
    return err(
      "TEMPLATE_NOT_FOUND",
      `Template inconnu : « ${input?.template ?? ""} ».`,
      `Templates disponibles : ${reg.templates.map((x) => x.id).join(", ")}.`,
    );
  }
  const details: string[] = [];
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text) {
    details.push(`« text » est requis : ${t.text_label} (max ${t.text_maxlen} caractères).`);
  } else if (text.length > t.text_maxlen) {
    details.push(`${t.text_label} trop long : ${t.text_maxlen} caractères max, ${text.length} reçus.`);
  }
  const o = input?.options ?? {};
  const props: Record<string, unknown> = { text };

  const format = typeof o.format === "string" && o.format ? o.format : config().default_format;
  if (!reg.sizes[format]) {
    details.push(`Format « ${format} » inconnu. Formats : ${Object.keys(reg.sizes).join(", ")}.`);
  } else {
    props.format = format;
  }

  const theme = typeof o.theme === "string" && o.theme ? o.theme : "dark";
  if (theme !== "dark" && theme !== "light") {
    details.push(`Palette « ${theme} » inconnue. Choix : dark, light.`);
  } else {
    props.theme = theme;
  }

  if (o.accent !== undefined && o.accent !== null && o.accent !== "") {
    if (typeof o.accent !== "string" || !HEX.test(o.accent)) {
      details.push("Accent invalide : hex #RRGGBB attendu (ex. #FFB224).");
    } else {
      props.accent = o.accent.toLowerCase();
    }
  }

  const params = (o.params ?? {}) as Record<string, unknown>;
  for (const def of t.params) {
    const v = params[def.key] ?? def.default;
    if (v === undefined || v === null || v === "") {
      if (def.required) details.push(`« ${def.key} » est requis : ${def.label}.`);
      else if (def.default !== undefined) props[def.key] = def.default;
      continue;
    }
    if (def.type === "string" && typeof v === "string") {
      if (def.maxlen && v.length > def.maxlen) details.push(`« ${def.key} » trop long : ${def.maxlen} caractères max, ${v.length} reçus.`);
      else props[def.key] = v;
    } else if (def.type === "enum") {
      if (typeof v === "string" && (def.options ?? []).includes(v)) props[def.key] = v;
      else details.push(`« ${def.key} » : valeur attendue parmi ${def.options?.join(", ")}.`);
    } else if (def.type === "string[]") {
      if (!Array.isArray(v)) {
        details.push(`« ${def.key} » : liste de chaînes attendue.`);
        continue;
      }
      const items = v.map((x) => String(x).trim()).filter(Boolean);
      if (items.length < (def.min_items ?? 0) || items.length > (def.max_items ?? 99)) {
        details.push(`« ${def.key} » : entre ${def.min_items} et ${def.max_items} éléments.`);
      } else if (items.some((x) => (def.item_maxlen ?? 999) < x.length)) {
        details.push(`« ${def.key} » : chaque élément fait ${def.item_maxlen} caractères max.`);
      } else {
        props[def.key] = items;
      }
    } else {
      details.push(`« ${def.key} » : type invalide.`);
    }
  }

  if (o.audio_path !== undefined && o.audio_path !== null && o.audio_path !== "") {
    if (typeof o.audio_path !== "string") {
      details.push("« audio_path » doit être un chemin de fichier.");
    } else {
      try {
        const st = fs.statSync(o.audio_path);
        if (st.size === 0) details.push("« audio_path » : fichier audio vide.");
        else if (st.size > 80 * 1024 * 1024) details.push("« audio_path » : fichier audio > 80 Mo.");
      } catch {
        details.push(`« audio_path » : fichier introuvable (${o.audio_path}).`);
      }
    }
  }

  if (details.length) {
    return err("INVALID_PARAMS", "Paramètres invalides.", "Corrige les champs signalés.", details);
  }
  return { ok: true, template: t, props, warnings: [] };
}

// ---- verrou (un seul rendu à la fois, partagé MCP + dashboard) ----

function lockDir(): string {
  return `${stateDir()}/render.lock`;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function isBusy(): boolean {
  try {
    const info = JSON.parse(fs.readFileSync(`${lockDir()}/owner.json`, "utf8")) as { pid: number; started_at: number };
    try {
      process.kill(info.pid, 0);
    } catch {
      return false; // pid mort → verrou périmé
    }
    return Date.now() - info.started_at < 2 * config().render_timeout_s * 1000;
  } catch {
    return false;
  }
}

function acquireLock(): boolean {
  const deadline = Date.now() + 240_000;
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
  } catch {
    return false;
  }
  for (;;) {
    if (!isBusy()) {
      fs.rmSync(lockDir(), { recursive: true, force: true });
      try {
        fs.mkdirSync(lockDir()); // atomique : seul le créateur gagne
        fs.writeFileSync(`${lockDir()}/owner.json`, JSON.stringify({ pid: process.pid, started_at: Date.now() }));
        return true;
      } catch {
        // course perdue → attendre
      }
    }
    if (Date.now() > deadline) return false;
    sleepSync(500);
  }
}

function releaseLock(): void {
  try {
    fs.rmSync(lockDir(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ---- état du moteur ----

export function engineStatus(): { installed: boolean; hint?: string } {
  const dir = engineDir();
  try {
    fs.readFileSync(`${dir}/node_modules/.bin/remotion`);
    fs.readFileSync(`${dir}/src/index.ts`);
    return { installed: true };
  } catch {
    return {
      installed: false,
      hint: `Moteur Remotion absent de ${dir} — réinstalle le plugin (setup) ou charge le skill quick-video-doctor.`,
    };
  }
}

// ---- rendu ----

function pruneJobs(keep = 20): void {
  try {
    const base = `${stateDir()}/jobs`;
    const dirs = fs
      .readdirSync(base)
      .map((d) => `${base}/${d}`)
      .sort();
    while (dirs.length > keep) {
      fs.rmSync(dirs.shift() as string, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

export async function renderVideo(input: RenderInput): Promise<RenderResult> {
  const v = validateRender(input);
  if (!v.ok) return v;
  const { template: t, props } = v;
  const warnings: string[] = [...v.warnings];
  const cfg = config();

  if (!acquireLock()) {
    return err("RENDER_BUSY", "Un rendu est déjà en cours.", "Réessaie dans quelques minutes.");
  }
  const startedAt = Date.now();
  const jobId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const jobDir = `${stateDir()}/jobs/${jobId}`;
  let audioTemp: string | null = null;

  try {
    const st = engineStatus();
    if (!st.installed) {
      return err("ENGINE_NOT_INSTALLED", "Moteur Remotion non installé.", st.hint);
    }

    try {
      fs.mkdirSync(cfg.output_dir, { recursive: true });
    } catch (e) {
      return err(
        "OUTPUT_DIR_UNWRITABLE",
        `Dossier de sortie inaccessible : ${cfg.output_dir} (${e instanceof Error ? e.message : String(e)}).`,
        "Ajuste le réglage output_dir du plugin.",
      );
    }

    fs.mkdirSync(jobDir, { recursive: true });

    // audio optionnel : copié dans public/ et passé en prop (rendu Remotion natif)
    const audioPath = input.options?.audio_path;
    const finalProps: Record<string, unknown> = { ...props };
    if (audioPath) {
      try {
        const ext = (audioPath.split(".").pop() ?? "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
        audioTemp = `${engineDir()}/public/qv-${jobId}.${ext}`;
        fs.mkdirSync(`${engineDir()}/public`, { recursive: true });
        fs.copyFileSync(audioPath, audioTemp);
        finalProps.audioFile = `qv-${jobId}.${ext}`;
      } catch (e) {
        warnings.push(`voice_skipped: piste audio non attachée (${e instanceof Error ? e.message : String(e)}) — vidéo muette.`);
        audioTemp = null;
      }
    }

    fs.writeFileSync(`${jobDir}/props.json`, JSON.stringify(finalProps));
    const outPath = `${jobDir}/out.mp4`;

    // subprocess Node — jamais d'import remotion côté Bun
    const args = [
      "remotion",
      "render",
      "src/index.ts",
      t.id,
      outPath,
      "--props",
      `${jobDir}/props.json`,
      "--codec",
      "h264",
      "--crf",
      "18",
      "--log",
      "error",
    ];
    let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
    try {
      proc = Bun.spawn(["npx", ...args], {
        cwd: engineDir(),
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env },
      });
    } catch (e) {
      return err(
        "ENGINE_NOT_INSTALLED",
        `Impossible de lancer Node/npx (${e instanceof Error ? e.message : String(e)}).`,
        "Vérifie l'installation de Node.js ou charge quick-video-doctor.",
      );
    }

    const stderrPromise = new Response(proc.stderr).text();
    const stdoutPromise = new Response(proc.stdout).text();
    const timeoutMs = cfg.render_timeout_s * 1000;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);

    const exitCode = await proc.exited;
    clearTimeout(timer);
    const stderrText = await stderrPromise;
    await stdoutPromise;

    if (audioTemp) {
      try {
        fs.rmSync(audioTemp);
      } catch {
        // ignore
      }
    }

    if (exitCode !== 0) {
      fs.writeFileSync(`${jobDir}/stderr.log`, stderrText.slice(-20_000));
      if (timedOut) {
        return err(
          "RENDER_TIMEOUT",
          `Rendu interrompu après ${Math.round((Date.now() - startedAt) / 1000)} s (timeout ${cfg.render_timeout_s} s).`,
          "Réessaie ; si ça persiste, augmente render_timeout_s ou choisis un template plus court.",
        );
      }
      if (/Chrome Headless Shell|Browser not installed|browser (is )?not/i.test(stderrText)) {
        return err(
          "BROWSER_MISSING",
          "Le navigateur headless de Remotion n'est pas installé.",
          "Relance l'installation du plugin (étape browser ensure) ou quick-video-doctor.",
        );
      }
      if (/Could not find command|command not found|ENOENT/i.test(stderrText) || exitCode === 127) {
        return err("ENGINE_NOT_INSTALLED", "Node/npx introuvable pour le rendu.", "Vérifie l'installation de Node.js.");
      }
      const tail = stderrText
        .trim()
        .split("\n")
        .slice(-3)
        .join(" | ")
        .slice(0, 2000);
      return err("RENDER_FAILED", `Le rendu a échoué (code ${exitCode}). ${tail}`, `Détails : ${jobDir}/stderr.log`);
    }

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 10_000) {
      fs.writeFileSync(`${jobDir}/stderr.log`, stderrText.slice(-20_000));
      return err("RENDER_EMPTY_OUTPUT", "Le rendu n'a produit aucun fichier exploitable.", `Détails : ${jobDir}/stderr.log`);
    }

    // livrer dans le dossier de sortie
    const stamp = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const fmt = String(props.format ?? "16:9");
    const name = `${t.id}-${fmt.replace(":", "x")}-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`;
    const finalPath = `${cfg.output_dir}/${name}`;
    try {
      fs.copyFileSync(outPath, finalPath);
    } catch (e) {
      return err(
        "OUTPUT_DIR_UNWRITABLE",
        `Impossible d'écrire ${finalPath} (${e instanceof Error ? e.message : String(e)}).`,
        "Ajuste le réglage output_dir du plugin.",
      );
    }
    const size = fs.statSync(finalPath).size;
    try {
      fs.writeFileSync(
        `${jobDir}/job.json`,
        JSON.stringify({ id: jobId, template: t.id, status: "done", video_path: finalPath, finished_at: new Date().toISOString() }),
      );
    } catch {
      // l'historique du dashboard vit ailleurs ; pas bloquant
    }
    pruneJobs();

    const reg = registry();
    const [width, height] = reg.sizes[fmt] ?? [1920, 1080];
    return {
      ok: true,
      video_path: finalPath,
      template: t.id,
      format: fmt,
      resolution: { width, height },
      duration_s: t.duration_s,
      file_size_bytes: size,
      warnings,
    };
  } finally {
    releaseLock();
  }
}

/** Résumés pour list_templates / la page dashboard. */
export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  duration_s: number | null;
  duration_formula?: string;
  formats: string[];
  text_param: string;
  text_label: string;
  text_maxlen: number;
  params: ParamDef[];
}> {
  const reg = registry();
  return reg.templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    duration_s: t.duration_s,
    duration_formula: t.duration_formula,
    formats: Object.keys(reg.sizes),
    text_param: t.text_param,
    text_label: t.text_label,
    text_maxlen: t.text_maxlen,
    params: t.params,
  }));
}
