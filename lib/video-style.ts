import path from "node:path";
import type { ShareTemplate } from "./api-types";

// Background MP4s ship with the app in `public/video-templates/` and ffmpeg
// reads them straight from disk — no external bucket dependency. (They were
// previously fetched from a Cloudflare `r2.dev` bucket we don't control/use,
// which meant every video render depended on that bucket being reachable.)
const TEMPLATE_DIR = path.join(process.cwd(), "public", "video-templates");

// `corporate` has no dedicated local asset yet, so it reuses `elegant` (closest
// visual fit). Drop a `public/video-templates/corporate.mp4` in and point this
// at it to give corporate its own look.
const TEMPLATE_FILE: Record<ShareTemplate, string> = {
  classic: "classic.mp4",
  elegant: "elegant.mp4",
  neon: "neon.mp4",
  playful: "playful.mp4",
  corporate: "elegant.mp4",
};

export type BackgroundSelector = {
  /** Song genre (any case). Accepted for call-site compatibility. */
  genre?: string | null;
  /** Stable seed (e.g. share id). Accepted for call-site compatibility. */
  seed?: string | null;
};

/**
 * Absolute filesystem path to the local background MP4 for a share video.
 * ffmpeg reads it directly from disk. Deterministic per template; the selector
 * is kept in the signature so existing callers don't change, but every template
 * currently ships a single local asset so it doesn't vary the file.
 */
export function templateVideoPath(template: ShareTemplate, _sel?: BackgroundSelector): string {
  const file = TEMPLATE_FILE[template] ?? "classic.mp4";
  return path.join(TEMPLATE_DIR, file);
}
