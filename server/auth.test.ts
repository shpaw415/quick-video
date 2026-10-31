import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("page auth protects UI, APIs and videos in checkout and frozen modes", async () => {
  const root = mkdtempSync(join(tmpdir(), "quick-video-auth-"));
  const keys = [
    "OPEN_BOT_PAGE_PORT", "OPEN_BOT_PAGE_TOKEN", "OPEN_BOT_PAGE_UI",
    "QUICK_VIDEO_DATA_DIR", "QUICK_VIDEO_STATE_DIR", "QUICK_VIDEO_ENGINE_DIR",
    "QUICK_VIDEO_CONFIG", "QUICK_VIDEO_OUTPUT_DIR", "QUICK_VIDEO_REGISTRY",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let cases = 0;
  try {
    for (const dir of ["data", "state", "output"]) mkdirSync(join(root, dir));
    process.env.OPEN_BOT_PAGE_PORT = "0";
    process.env.QUICK_VIDEO_DATA_DIR = join(root, "data");
    process.env.QUICK_VIDEO_STATE_DIR = join(root, "state");
    process.env.QUICK_VIDEO_OUTPUT_DIR = join(root, "output");
    process.env.QUICK_VIDEO_ENGINE_DIR = join(root, "missing-engine");
    process.env.QUICK_VIDEO_CONFIG = join(root, "config.json");
    process.env.QUICK_VIDEO_REGISTRY = resolve(import.meta.dir, "../remotion/src/registry.json");
    writeFileSync(join(root, "config.json"), "{}");
    writeFileSync(join(root, "fixture.mp4"), "isolated-video-fixture");
    writeFileSync(join(root, "ui.html"), '<!doctype html><script>window.__QV_TOKEN__="__QV_TOKEN__";</script>');
    const jobs = JSON.stringify([{
      id: "123-test", status: "done", video_path: join(root, "fixture.mp4"),
    }]);
    writeFileSync(join(root, "data/jobs.json"), jobs);

    for (const frozen of [false, true]) {
      if (frozen) process.env.OPEN_BOT_PAGE_UI = join(root, "ui.html");
      else delete process.env.OPEN_BOT_PAGE_UI;
      for (const token of [undefined, "test-production-token", "dev-preview", 'test-<tag>-"quote"']) {
        if (token === undefined) delete process.env.OPEN_BOT_PAGE_TOKEN;
        else process.env.OPEN_BOT_PAGE_TOKEN = token;
        const source = process.env.QUICK_VIDEO_AUTH_TEST_SERVER ?? "./server.ts";
        const { default: server } = await import(`${source}?auth-case=${cases++}`);
        const base = `http://127.0.0.1:${server.port}`;
        try {
          expect((await fetch(`${base}/healthz`)).status).toBe(200);
          for (const credential of [undefined, "", "wrong-token", "dev-preview", token]) {
            const headers: Record<string, string> = {};
            if (credential !== undefined) headers["x-open-bot-page-token"] = credential;
            const accepted = !!token && credential === token;
            for (const path of ["/", "/api/templates", "/api/renders", "/api/renders/123-test", "/api/renders/123-test/video"]) {
              const response = await fetch(base + path, { headers });
              expect(response.status).toBe(accepted ? 200 : 403);
              const body = await response.text();
              if (!accepted) expect(body).toBe('{"error":"unauthorized"}');
              if (accepted && path === "/") {
                expect(body).toContain("window.__QV_TOKEN__");
                expect(body).toContain(JSON.stringify(token).replace(/</g, "\\u003c"));
                expect(body).not.toContain('"__QV_TOKEN__"');
              }
              if (accepted && path.endsWith("/video")) expect(body).toBe("isolated-video-fixture");
            }
            // Invalid authenticated input exercises validation without rendering;
            // valid unauthenticated input must be rejected before creating a job.
            const response = await fetch(`${base}/api/renders`, {
              method: "POST", headers: { ...headers, "content-type": "application/json" },
              body: JSON.stringify({ template: accepted ? "invalid" : "hook", text: "Auth test" }),
            });
            expect(response.status).toBe(accepted ? 400 : 403);
            expect(await Bun.file(join(root, "data/jobs.json")).text()).toBe(jobs);
          }
        } finally {
          await server.stop(true);
        }
      }
    }
    expect(cases).toBe(8);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    if (!root.startsWith(join(tmpdir(), "quick-video-auth-"))) throw new Error("Unsafe cleanup path");
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
