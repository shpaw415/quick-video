// quick-video — serveur MCP stdio (JSON-RPC 2.0 minimal, zéro dépendance).
// Installé à plat : le renderer vit à côté (ob-plugin-quick-video-renderer.ts).
let R: typeof import("renderer");
try {
  R = await import("/usr/local/bin/ob-plugin-quick-video-renderer.ts");
} catch {
  R = await import("../render/renderer.ts");
}

interface RpcMsg {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function toolSchemas(): Array<Record<string, unknown>> {
  return [
    {
      name: "list_templates",
      description:
        "List the available quick-video templates (animated quote, verse of the day, announce, hook, list) with their parameters, durations and formats.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "render",
      description:
        "Render a finished MP4 (1080p, 16:9 or 9:16) from a template and a text. CPU-bound: a typical render takes 1-3 minutes — confirm with the user before rendering more than ~20 s of video. The file lands in the workspace output dir; embed it in your reply as ![description](path). Optional audio_path muxes a voice track (wav/mp3/m4a/aac/ogg).",
      inputSchema: {
        type: "object",
        required: ["template", "text"],
        properties: {
          template: {
            type: "string",
            description: "Template id (see list_templates): quote | verse | announce | hook | list.",
          },
          text: { type: "string", description: "Main text (the quote, the verse, the title...). Length limits per template." },
          options: {
            type: "object",
            properties: {
              format: { type: "string", enum: ["16:9", "9:16"], description: "16:9 YouTube (default) or 9:16 shorts." },
              theme: { type: "string", enum: ["dark", "light"], description: "Palette. Default dark." },
              accent: { type: "string", description: "Accent color override, hex #RRGGBB." },
              params: {
                type: "object",
                description:
                  "Template-specific params, e.g. {author, role} for quote; {reference, translation} for verse; {kicker, subtitle, cta} for announce; {items: [3-5 strings], number_style} for list; *word* highlights in hook text.",
              },
              audio_path: { type: "string", description: "Optional audio track (voice/music) muxed onto the video." },
            },
          },
        },
      },
    },
  ];
}

function textResult(payload: unknown, isError = false): Record<string, unknown> {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function handle(msg: RpcMsg): Promise<Record<string, unknown> | null> {
  if (!msg || typeof msg.method !== "string") return null;
  if (msg.method.startsWith("notifications/")) return null; // pas de réponse aux notifications

  switch (msg.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: msg.id ?? null,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "quick-video", version: "0.1.0" },
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id: msg.id ?? null, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id: msg.id ?? null, result: { tools: toolSchemas() } };
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      let args: Record<string, unknown> = {};
      const raw = msg.params?.arguments;
      if (raw && typeof raw === "object") args = raw as Record<string, unknown>;
      try {
        if (name === "list_templates") {
          const engine = R.engineStatus();
          return {
            jsonrpc: "2.0",
            id: msg.id ?? null,
            result: textResult({ templates: R.listTemplates(), engine, busy: R.isBusy() }),
          };
        }
        if (name === "render") {
          const result = await R.renderVideo({
            template: String(args.template ?? ""),
            text: String(args.text ?? ""),
            options: (args.options ?? {}) as Record<string, never>,
          });
          return { jsonrpc: "2.0", id: msg.id ?? null, result: textResult(result, !result.ok) };
        }
        return {
          jsonrpc: "2.0",
          id: msg.id ?? null,
          error: { code: -32602, message: `Outil inconnu : ${name}` },
        };
      } catch (e) {
        return {
          jsonrpc: "2.0",
          id: msg.id ?? null,
          result: textResult(
            { ok: false, error: { code: "INTERNAL", message: e instanceof Error ? e.message : String(e) } },
            true,
          ),
        };
      }
    }
    default:
      if (msg.id !== undefined && msg.id !== null) {
        return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Méthode inconnue : ${msg.method}` } };
      }
      return null;
  }
}

const decoder = new TextDecoder();
let buffer = "";

function feed(chunk: Uint8Array): void {
  buffer += decoder.decode(chunk, { stream: true });
  let idx: number;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg: RpcMsg;
    try {
      msg = JSON.parse(line) as RpcMsg;
    } catch {
      Bun.write(
        Bun.stderr,
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } }) + "\n",
      );
      continue;
    }
    void handle(msg).then((resp) => {
      if (resp) process.stdout.write(JSON.stringify(resp) + "\n");
    });
  }
}

const reader = Bun.stdin.stream().getReader();
void (async () => {
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) feed(value);
  }
})();
