// quick-video — logique de la page dashboard.
const TOKEN: string = (window as unknown as { __QV_TOKEN__?: string }).__QV_TOKEN__ ?? "";

interface ParamDef {
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
interface TemplateDef {
  id: string;
  name: string;
  description: string;
  duration_s: number | null;
  duration_formula?: string;
  formats: string[];
  text_label: string;
  text_maxlen: number;
  params: ParamDef[];
}
interface Job {
  id: string;
  template: string;
  format: string;
  status: "queued" | "rendering" | "done" | "failed";
  created_at: string;
  video_path?: string;
  warnings?: string[];
  error?: { code: string; message: string; hint?: string; details?: string[] };
}

// ---- i18n : langue de l'utilisateur, jamais de langue par défaut codée en dur ----
const STRINGS: Record<string, Record<string, string>> = {
  fr: {
    "status.checking": "Vérification du moteur…",
    "status.ok": "Connecté au moteur de rendu",
    "status.missing": "Moteur non installé — réinstalle le plugin",
    "status.busy": "Un rendu est en cours",
    "sec.templates": "Choisir un template",
    "sec.content": "Contenu",
    "sec.generate": "Générer",
    "sec.preview": "Aperçu",
    "sec.history": "Historique",
    "gen.go": "Générer le MP4",
    "gen.done": "✅ Vidéo prête",
    "gen.watch": "Voir la vidéo",
    "gen.busy": "Rendu en cours…",
    "progress.running": "Rendu en cours… (typique : 1 à 3 minutes)",
    "err.connect": "Impossible de joindre le plugin.",
    "err.retry": "Réessayer",
    "err.render": "Le rendu a échoué.",
    "preview.safe": "Zones sûres (recouvrement YouTube/Shorts)",
    "form.palette": "Palette",
    "form.format": "Format",
    "form.accent": "Couleur d'accent (optionnelle)",
    "form.itemsHelp": "Un point par ligne (3 à 5).",
    "hist.empty": "Aucun rendu pour l'instant — ton premier MP4 est à 3 champs d'ici.",
    "hist.copy": "Copier le chemin",
    "hist.regen": "Régénérer",
    "hist.chars": "car.",
    "param.author": "Auteur",
    "param.role": "Rôle / organisation",
    "param.reference": "Référence",
    "param.translation": "Traduction",
    "param.kicker": "Surtitre",
    "param.subtitle": "Sous-titre",
    "param.cta": "Bouton d'action",
    "param.items": "Points de la liste",
    "param.number_style": "Style de numéros",
  },
  en: {
    "status.checking": "Checking the render engine…",
    "status.ok": "Connected to the render engine",
    "status.missing": "Engine not installed — reinstall the plugin",
    "status.busy": "A render is running",
    "sec.templates": "Pick a template",
    "sec.content": "Content",
    "sec.generate": "Generate",
    "sec.preview": "Preview",
    "sec.history": "History",
    "gen.go": "Generate the MP4",
    "gen.done": "✅ Video ready",
    "gen.watch": "Watch the video",
    "gen.busy": "Rendering…",
    "progress.running": "Rendering… (typically 1 to 3 minutes)",
    "err.connect": "Cannot reach the plugin.",
    "err.retry": "Retry",
    "err.render": "The render failed.",
    "preview.safe": "Safe areas (YouTube/Shorts overlay)",
    "form.palette": "Palette",
    "form.format": "Format",
    "form.accent": "Accent color (optional)",
    "form.itemsHelp": "One point per line (3 to 5).",
    "hist.empty": "No renders yet — your first MP4 is 3 fields away.",
    "hist.copy": "Copy path",
    "hist.regen": "Regenerate",
    "hist.chars": "chars",
    "param.author": "Author",
    "param.role": "Role / organization",
    "param.reference": "Reference",
    "param.translation": "Translation",
    "param.kicker": "Kicker",
    "param.subtitle": "Subtitle",
    "param.cta": "Call to action",
    "param.items": "List points",
    "param.number_style": "Number style",
  },
};
const urlLang = new URLSearchParams(location.search).get("lang");
const navLang = navigator.language || "en";
const LANG = urlLang ?? (navLang.toLowerCase().startsWith("fr") ? "fr" : "en");
function t(key: string): string {
  return STRINGS[LANG]?.[key] ?? STRINGS.en[key] ?? STRINGS.fr[key] ?? key;
}
function applyStatic(): void {
  document.querySelectorAll<HTMLElement>("[data-t]").forEach((el) => {
    el.textContent = t(el.dataset.t ?? "");
  });
}

// ---- réseau ----
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (TOKEN) headers["x-open-bot-page-token"] = TOKEN;
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

const $ = <E extends HTMLElement = HTMLElement>(id: string): E => document.getElementById(id) as E;

// ---- état ----
let templates: TemplateDef[] = [];
let selected = "";
let palette: "dark" | "light" = document.documentElement.dataset.theme === "light" ? "light" : "dark";
let format = "16:9";
let polling: ReturnType<typeof setInterval> | null = null;
let renderBusy = false;

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// ---- initialisation ----
async function init(): Promise<void> {
  applyStatic();
  try {
    const data = await api<{ templates: TemplateDef[]; engine: { installed: boolean; hint?: string }; busy: boolean }>("api/templates");
    templates = data.templates;
    setStatus(data.engine.installed ? (data.busy ? "busy" : "ok") : "missing", data.engine.hint);
    renderTemplateCards();
    if (templates.length) {
      selected = templates[0].id;
      selectTemplate(selected);
    }
    void refreshHistory();
  } catch (e) {
    showFatal(e instanceof Error ? e.message : String(e));
  }
}

function setStatus(kind: "ok" | "missing" | "busy", hint?: string): void {
  const el = $("engine-status");
  const cls = kind === "ok" ? "dot-ok" : kind === "busy" ? "dot-busy" : "dot-err";
  const label = kind === "ok" ? t("status.ok") : kind === "busy" ? t("status.busy") : t("status.missing");
  el.innerHTML = `<span class="dot ${cls}"></span>${esc(label)}${hint ? ` — ${esc(hint)}` : ""}`;
}

function showFatal(detail: string): void {
  $("fatal").hidden = false;
  $("fatal-detail").textContent = detail;
  setStatus("missing");
}
$("fatal-retry").addEventListener("click", () => {
  $("fatal").hidden = true;
  void init();
});

// ---- cartes templates (miniatures SVG inline) ----
const THUMBS: Record<string, string> = {
  quote: `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="8" class="t-bg"/><text x="22" y="66" class="t-quote">«</text><rect x="24" y="82" width="236" height="12" rx="6" class="t-bar"/><rect x="24" y="104" width="196" height="12" rx="6" class="t-bar"/><rect x="24" y="126" width="156" height="12" rx="6" class="t-bar"/><rect x="24" y="152" width="48" height="5" rx="2.5" class="t-accent"/></svg>`,
  verse: `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="8" class="t-bg"/><rect x="98" y="46" width="124" height="6" rx="3" class="t-accent"/><rect x="60" y="72" width="200" height="11" rx="5.5" class="t-bar"/><rect x="76" y="92" width="168" height="11" rx="5.5" class="t-bar"/><text x="160" y="136" text-anchor="middle" class="pv-kicker" font-size="13">—</text><rect x="120" y="146" width="80" height="6" rx="3" class="t-accent"/></svg>`,
  announce: `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="8" class="t-bg"/><circle cx="230" cy="52" r="46" class="t-accent" opacity="0.18"/><rect x="26" y="42" width="70" height="14" rx="7" class="t-accent" opacity="0.5"/><rect x="26" y="70" width="180" height="16" rx="8" class="t-bar"/><rect x="26" y="96" width="120" height="5" rx="2.5" class="t-accent"/><rect x="26" y="114" width="212" height="9" rx="4.5" class="t-dim"/><rect x="26" y="138" width="96" height="22" rx="11" class="t-accent"/></svg>`,
  hook: `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="8" class="t-bg"/><rect x="26" y="62" width="230" height="20" rx="6" class="t-bar"/><rect x="188" y="92" width="106" height="24" rx="6" class="t-accent"/><rect x="26" y="96" width="150" height="18" rx="5" class="t-bar"/></svg>`,
  list: `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" rx="8" class="t-bg"/><rect x="26" y="36" width="150" height="13" rx="6.5" class="t-bar"/><rect x="26" y="56" width="60" height="5" rx="2.5" class="t-accent"/><circle cx="38" cy="88" r="9" class="t-accent" opacity="0.7"/><rect x="56" y="83" width="180" height="10" rx="5" class="t-bar"/><circle cx="38" cy="118" r="9" class="t-accent" opacity="0.7"/><rect x="56" y="113" width="150" height="10" rx="5" class="t-bar"/><circle cx="38" cy="148" r="9" class="t-accent" opacity="0.7"/><rect x="56" y="143" width="165" height="10" rx="5" class="t-bar"/></svg>`,
};

function renderTemplateCards(): void {
  const grid = $("tpl-grid");
  grid.innerHTML = templates
    .map(
      (tp) => `<button type="button" class="tpl-card" data-template="${esc(tp.id)}" aria-pressed="false">
        ${THUMBS[tp.id] ?? ""}
        <span class="tpl-name">${esc(tp.name)}</span>
      </button>`,
    )
    .join("");
  grid.querySelectorAll<HTMLButtonElement>(".tpl-card").forEach((btn) => {
    btn.addEventListener("click", () => selectTemplate(btn.dataset.template ?? ""));
  });
}

// ---- formulaire dynamique ----
function field(def: { key: string; label: string; required?: boolean; maxlen?: number; help?: string; textarea?: boolean; value?: string }): string {
  const id = `f-${def.key}`;
  const input = def.textarea
    ? `<textarea id="${id}" rows="3" maxlength="${def.maxlen ?? 500}">${esc(def.value ?? "")}</textarea>`
    : `<input type="text" id="${id}" maxlength="${def.maxlen ?? 200}" value="${esc(def.value ?? "")}">`;
  return `<label class="field">
    <span class="field-label">${esc(def.label)}${def.required ? " *" : ""}</span>
    ${input}
    <span class="field-help"><span>${esc(def.help ?? (def.required ? "Requis." : "Optionnel."))}</span>
    ${def.maxlen ? `<span class="counter" data-counter="${id}">0/${def.maxlen}</span>` : ""}</span>
  </label>`;
}

function seg(id: string, ariaLabel: string, options: Array<[string, string]>, current: string): string {
  return `<div class="seg" role="radiogroup" aria-label="${esc(ariaLabel)}" id="${id}">
    ${options
      .map(
        ([value, label]) =>
          `<button type="button" role="radio" aria-checked="${value === current ? "true" : "false"}" data-value="${value}">${esc(label)}</button>`,
      )
      .join("")}
  </div>`;
}

function selectTemplate(id: string): void {
  selected = id;
  const tp = templates.find((x) => x.id === id);
  if (!tp) return;
  document.querySelectorAll<HTMLButtonElement>(".tpl-card").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.template === id));
  });
  const paramsHtml = tp.params
    .map((p) => {
      const label = t(`param.${p.key}`) === `param.${p.key}` ? p.label : t(`param.${p.key}`);
      if (p.type === "enum") {
        return `<label class="field"><span class="field-label">${esc(label)}${p.required ? " *" : ""}</span>
          <select data-param="${esc(p.key)}">${(p.options ?? [])
            .map((o) => `<option value="${esc(o)}"${o === p.default ? " selected" : ""}>${esc(o)}</option>`)
            .join("")}</select></label>`;
      }
      if (p.type === "string[]") {
        return `<label class="field"><span class="field-label">${esc(label)} *</span>
          <textarea data-param="${esc(p.key)}" rows="5" data-items="1"></textarea>
          <span class="field-help"><span>${esc(t("form.itemsHelp"))}</span></span></label>`;
      }
      return field({
        key: p.key,
        label,
        required: p.required,
        maxlen: p.maxlen,
        textarea: (p.maxlen ?? 0) > 60,
      }).replace("<input", `<input data-param="${esc(p.key)}"`);
    })
    .join("");
  $("form").innerHTML = `
    ${field({ key: "text", label: tp.text_label, required: true, maxlen: tp.text_maxlen, textarea: tp.text_maxlen > 60, help: `${tp.description}` }).replace("<input", "<input data-main=\"1\"")}
    ${paramsHtml}
    <span class="field-label">${esc(t("form.palette"))}</span>
    ${seg("seg-palette", t("form.palette"), [["dark", "Nuit"], ["light", "Jour"]], palette)}
    <span class="field-label">${esc(t("form.format"))}</span>
    ${seg("seg-format", t("form.format"), [["16:9", "16:9 · YouTube"], ["9:16", "9:16 · Shorts"]], format)}
    ${field({ key: "accent", label: t("form.accent"), maxlen: 7 }).replace("<input", '<input data-accent="1" placeholder="#FFB224"')}
  `;
  bindForm();
  drawPreview();
}

function readForm(): { text: string; params: Record<string, unknown>; accent?: string } {
  const main = document.querySelector<HTMLInputElement>("[data-main]");
  const params: Record<string, unknown> = {};
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-param]").forEach((el) => {
    const key = el.getAttribute("data-param") ?? "";
    if (el instanceof HTMLTextAreaElement && el.hasAttribute("data-items")) {
      params[key] = el.value
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
    } else if (el.value !== "") {
      params[key] = el.value;
    }
  });
  const accentEl = document.querySelector<HTMLInputElement>("[data-accent]");
  return { text: main?.value.trim() ?? "", params, accent: accentEl?.value.trim() || undefined };
}

function bindForm(): void {
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[maxlength],textarea[maxlength]").forEach((el) => {
    const counter = document.querySelector<HTMLElement>(`[data-counter="${el.id}"]`);
    const update = (): void => {
      if (counter) counter.textContent = `${el.value.length}/${el.getAttribute("maxlength")}`;
      drawPreview();
    };
    el.addEventListener("input", update);
    update();
  });
  const bindSeg = (id: string, cb: (v: string) => void): void => {
    const segEl = $(id);
    segEl.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.addEventListener("click", () => {
        segEl.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        cb(b.dataset.value ?? "");
      });
    });
  };
  bindSeg("seg-palette", (v) => {
    palette = v === "light" ? "light" : "dark";
    document.querySelector(".page")?.setAttribute("data-palette", palette);
    drawPreview();
  });
  bindSeg("seg-format", (v) => {
    format = v;
    drawPreview();
  });
}

// ---- aperçu SVG avec zones sûres ----
function drawPreview(): void {
  const tp = templates.find((x) => x.id === selected);
  const svg = $("preview");
  const vertical = format === "9:16";
  svg.setAttribute("viewBox", vertical ? "0 0 180 320" : "0 0 320 180");
  const W = vertical ? 180 : 320;
  const H = vertical ? 320 : 180;
  const { text, params } = readForm();
  const main = text || (vertical ? "Ton texte ici" : "Ton texte ici");
  const safe = vertical ? { x: 16, y: 40, w: 148, h: 200 } : { x: 20, y: 16, w: 280, h: 142 };
  const cx = W / 2;
  const cy = H * 0.45;
  const parts: string[] = [`<rect width="${W}" height="${H}" class="t-bg"/>`];
  const titleSize = vertical ? 15 : 17;
  const words = main.split(/\s+/);
  const maxChars = vertical ? 18 : 30;
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars && line) {
      lines.push(line.trim());
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  if (selected === "verse") {
    const ref = String(params.reference ?? "") || "—";
    parts.push(`<text x="${cx}" y="${cy - 58}" text-anchor="middle" class="pv-kicker" font-size="9">${esc((String(params.kicker ?? "") || "Verset du jour").toUpperCase())}</text>`);
    lines.slice(0, 4).forEach((l, i) => {
      parts.push(`<text x="${cx}" y="${cy - 30 + i * 22}" text-anchor="middle" class="pv-title" font-size="${titleSize - 2}">${esc(l)}</text>`);
    });
    parts.push(`<text x="${cx}" y="${cy - 30 + Math.min(lines.length, 4) * 22 + 8}" text-anchor="middle" class="pv-kicker" font-size="11">${esc(`— ${ref}`)}</text>`);
  } else if (selected === "hook") {
    lines.slice(0, 3).forEach((l, i) => {
      parts.push(`<text x="${cx}" y="${cy - 16 + i * 26}" text-anchor="middle" class="pv-title" font-size="${titleSize + 3}">${esc(l.replace(/\*/g, ""))}</text>`);
    });
  } else if (selected === "announce") {
    parts.push(`<rect x="${vertical ? 30 : 26}" y="${cy - 46}" width="44" height="12" rx="6" class="t-accent" opacity="0.6"/>`);
    lines.slice(0, 2).forEach((l, i) => {
      parts.push(`<text x="${vertical ? cx : 26}" y="${cy - 12 + i * 24}" text-anchor="${vertical ? "middle" : "start"}" class="pv-title" font-size="${titleSize}">${esc(l)}</text>`);
    });
    parts.push(`<rect x="${vertical ? 30 : 26}" y="${cy + 42}" width="${vertical ? 120 : 96}" height="20" rx="10" class="pv-pill"/>`);
    const cta = String(params.cta ?? "");
    if (cta) parts.push(`<text x="${vertical ? 90 : 74}" y="${cy + 56}" text-anchor="middle" class="pv-onaccent" font-size="10">${esc(cta)}</text>`);
  } else if (selected === "list") {
    const items = (Array.isArray(params.items) ? (params.items as string[]) : []).slice(0, 5);
    const title = main.slice(0, 30);
    parts.push(`<text x="${vertical ? 30 : 26}" y="${cy - 44}" class="pv-title" font-size="${titleSize - 1}">${esc(title)}</text>`);
    parts.push(`<rect x="${vertical ? 30 : 26}" y="${cy - 34}" width="40" height="3" class="t-accent"/>`);
    (items.length ? items : ["Point 1", "Point 2", "Point 3"]).slice(0, 5).forEach((it, i) => {
      const y = cy - 12 + i * 22;
      parts.push(`<circle cx="${vertical ? 38 : 34}" cy="${y - 4}" r="7" class="t-accent" opacity="0.75"/>`);
      parts.push(`<text x="${vertical ? 52 : 48}" y="${y}" class="pv-dim" font-size="11">${esc(String(it).slice(0, vertical ? 16 : 28))}</text>`);
    });
  } else {
    // quote
    parts.push(`<text x="${vertical ? 24 : 22}" y="${cy - 34}" class="t-quote" font-size="30">«</text>`);
    lines.slice(0, 4).forEach((l, i) => {
      parts.push(`<text x="${vertical ? cx : 26}" y="${cy - 6 + i * 21}" text-anchor="${vertical ? "middle" : "start"}" class="pv-title" font-size="${titleSize - 1}">${esc(l)}</text>`);
    });
    const author = String(params.author ?? "");
    if (author) parts.push(`<text x="${vertical ? cx : 26}" y="${cy - 6 + Math.min(lines.length, 4) * 21 + 10}" text-anchor="${vertical ? "middle" : "start"}" class="pv-dim" font-size="10">${esc(author)}</text>`);
  }
  if ($("safe-toggle").checked) {
    parts.push(`<rect x="${safe.x}" y="${safe.y}" width="${safe.w}" height="${safe.h}" fill="none" stroke="#E5484D" stroke-width="1.5" stroke-dasharray="5 4"/>`);
  }
  svg.innerHTML = parts.join("");
}
$("safe-toggle").addEventListener("change", drawPreview);

// ---- génération + polling ----
function setBusy(busy: boolean): void {
  renderBusy = busy;
  const btn = $("generate") as HTMLButtonElement;
  btn.disabled = busy;
  btn.textContent = busy ? t("gen.busy") : t("gen.go");
  $("progress").hidden = !busy;
  $("progress-label").hidden = !busy;
  if (busy) window.addEventListener("beforeunload", preventLeave);
  else window.removeEventListener("beforeunload", preventLeave);
}
function preventLeave(e: BeforeUnloadEvent): void {
  e.preventDefault();
}

$("generate").addEventListener("click", () => {
  if (renderBusy) return;
  const { text, params, accent } = readForm();
  if (!text) return;
  setBusy(true);
  $("success").hidden = true;
  void (async () => {
    try {
      const { id } = await api<{ id: string }>("api/renders", {
        method: "POST",
        body: JSON.stringify({ template: selected, text, options: { format, theme: palette, accent, params } }),
      });
      polling = setInterval(() => void pollJob(id), 2000);
      void refreshHistory();
    } catch (e) {
      setBusy(false);
      showRenderError(e instanceof Error ? e.message : String(e));
    }
  })();
});

function pollJob(id: string): void {
  void (async () => {
    try {
      const job = await api<Job>(`api/renders/${id}`);
      if (job.status === "done") {
        if (polling) clearInterval(polling);
        polling = null;
        setBusy(false);
        $("success").hidden = false;
        $("success-path").textContent = job.video_path ?? "";
        const player = $("success-player") as HTMLVideoElement;
        player.src = `api/renders/${id}/video`;
        void refreshHistory();
      } else if (job.status === "failed") {
        if (polling) clearInterval(polling);
        polling = null;
        setBusy(false);
        showRenderError(job.error ? `${job.error.message}${job.error.hint ? ` — ${job.error.hint}` : ""}` : "erreur inconnue");
        void refreshHistory();
      }
    } catch {
      // réseau transitoire : on retente au prochain tick
    }
  })();
}

function showRenderError(message: string): void {
  const fatal = $("fatal");
  fatal.hidden = false;
  fatal.querySelector("strong")!.textContent = t("err.render");
  $("fatal-detail").textContent = message;
}

// ---- historique ----
async function refreshHistory(): Promise<void> {
  try {
    const { jobs } = await api<{ jobs: Job[] }>("api/renders");
    const list = $("history");
    $("history-empty").hidden = jobs.length > 0;
    list.innerHTML = jobs
      .map((job) => {
        const badge =
          job.status === "done"
            ? '<span class="badge ok">MP4</span>'
            : job.status === "failed"
              ? '<span class="badge err">✗</span>'
              : '<span class="badge run">⏳</span>';
        const when = new Date(job.created_at).toLocaleTimeString?.() ?? job.created_at;
        return `<li data-job="${esc(job.id)}" data-path="${esc(job.video_path ?? "")}" data-template="${esc(job.template)}">
          ${THUMBS[job.template] ?? '<svg viewBox="0 0 320 180"><rect width="320" height="180" class="t-bg"/></svg>'}
          <div class="hist-info">
            <strong>${esc(job.video_path ? job.video_path.split("/").pop() ?? "" : `${job.template} · ${job.format}`)}</strong>
            <span class="hist-meta">${esc(job.template)} · ${esc(job.format)} · ${esc(when)}</span>
          </div>
          ${badge}
          ${job.video_path ? `<button type="button" class="ghost" data-copy="${esc(job.video_path)}">${esc(t("hist.copy"))}</button>` : ""}
          ${job.status === "done" ? `<button type="button" class="ghost" data-regen="${esc(job.id)}">${esc(t("hist.regen"))}</button>` : ""}
        </li>`;
      })
      .join("");
    list.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => void navigator.clipboard?.writeText(btn.dataset.copy ?? ""));
    });
    list.querySelectorAll<HTMLButtonElement>("[data-regen]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // v0.1 : recharge la vidéo dans le lecteur — pas de re-file automatique
        const job = jobs.find((j) => j.id === btn.dataset.regen);
        if (job?.video_path) {
          $("success").hidden = false;
          $("success-path").textContent = job.video_path;
          const player = $("success-player") as HTMLVideoElement;
          const id = job.id;
          player.src = `api/renders/${id}/video`;
        }
      });
    });
  } catch {
    // l'historique ne bloque jamais la page
  }
}

void init();
