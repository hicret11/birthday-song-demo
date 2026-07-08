import type { SharedSong } from "./api-types";

// Server-side paywall enforcement.
//
// The share page serializes the SharedSong into the client payload. If a LOCKED
// song's full-media URLs (raw Suno audio, highlight cut, full track, share
// video, premium video, slideshow) ride along in that payload, a visitor can
// read them straight out of the HTML/JS and grab the full song for free — the
// 15s client-side clamp is trivially bypassable.
//
// toPublicSong is the gate: for a locked song it strips every full-media URL
// before the payload leaves the server, leaving only what a non-paying visitor
// is allowed to have — lyrics, metadata, and (implicitly) the gated 15s preview
// served by /api/share/[id]/preview. Unlocked songs pass through untouched.

/** Fields that must never reach a locked song's client payload. */
const LOCKED_STRIP_KEYS = [
  "audioUrl",
  "highlightAudioUrl",
  "fullAudioUrl",
  "previewAudioUrl",
  "videoUrl",
  "premiumVideoUrl",
  "slideshowVideoUrl",
] as const;

export function toPublicSong(song: SharedSong): SharedSong {
  if (song.unlocked) return song;

  // Locked: clone and blank out every direct media URL. audioUrl is required by
  // the type, so we set it to an empty string; the client plays the gated
  // preview route instead of any direct URL.
  const safe: SharedSong = { ...song, audioUrl: "" };
  for (const key of LOCKED_STRIP_KEYS) {
    // Delete optional URL fields entirely; audioUrl was already blanked above.
    if (key !== "audioUrl") {
      delete (safe as Record<string, unknown>)[key];
    }
  }
  return safe;
}
