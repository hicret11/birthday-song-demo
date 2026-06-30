import type { ShareTemplate } from "./api-types";

const R2_TEMPLATE_BASE = "https://pub-4a5a0d0e9e504b74a6c9751524055c49.r2.dev/templates";

// Background MP4 variants per template. Each template currently has ONE asset on
// R2, so selection is a no-op and output is byte-identical to before. To add
// visual variety, upload more 60s MP4s to R2 under `templates/` and list their
// filenames here — selection then varies deterministically per song.
// Naming convention + how-to: docs/VIDEO-BACKGROUNDS.md.
const TEMPLATE_VARIANTS: Record<ShareTemplate, string[]> = {
  classic: ["classic-60s.mp4"],
  elegant: ["elegant-60s.mp4"],
  neon: ["neon-60s.mp4"],
  playful: ["playful-60s.mp4"],
  corporate: ["corporate-60s.mp4"],
};

// Optional extra backgrounds keyed by lowercased song genre, layered on top of a
// template's own variants when present. Empty by default — populate only after
// the matching assets are uploaded to R2, e.g. pop: ["pop-a-60s.mp4", "pop-b-60s.mp4"].
const GENRE_VARIANTS: Record<string, string[]> = {};

/** Stable 32-bit FNV-1a hash — deterministic across processes/runs. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type BackgroundSelector = {
  /** Song genre (any case) — pulls in genre-themed backgrounds when registered. */
  genre?: string | null;
  /** Stable seed (e.g. share id) so the same song always renders the same background. */
  seed?: string | null;
};

/**
 * Resolve the background MP4 URL for a share video.
 *
 * Deterministic: the same (template, genre, seed) always yields the same URL, so
 * retries/regenerations stay stable. Falls back to the canonical
 * `{template}-60s.mp4` when no variants are registered. With one variant per
 * template (current state) this returns exactly the original asset — there is no
 * behavior change until more assets are uploaded and listed above.
 */
export function templateVideoPath(template: ShareTemplate, sel?: BackgroundSelector): string {
  const genreKey = (sel?.genre ?? "").toLowerCase().trim();
  const base = TEMPLATE_VARIANTS[template] ?? [];
  const genreExtra = genreKey ? GENRE_VARIANTS[genreKey] ?? [] : [];
  const pool = [...base, ...genreExtra].filter(Boolean);
  const candidates = pool.length > 0 ? pool : [`${template}-60s.mp4`];
  const idx = candidates.length > 1 ? hash32(`${template}|${genreKey}|${sel?.seed ?? ""}`) % candidates.length : 0;
  return `${R2_TEMPLATE_BASE}/${candidates[idx]}`;
}
