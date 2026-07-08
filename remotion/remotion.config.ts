// Remotion CLI/config for the render worker. See https://remotion.dev/docs/config
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// H.264 MP4 is the most broadly playable format for shareable social videos.
Config.setCodec("h264");
// Chromium flags that help headless rendering in containers (no GPU/sandbox).
Config.setChromiumOpenGlRenderer("angle");
