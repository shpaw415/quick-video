// quick-video engine — Remotion configuration.
// Deterministic, CPU-friendly defaults: JPEG frames, overwrite outputs.
// Concurrency is passed per-render on the CLI (--concurrency), not pinned here.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
