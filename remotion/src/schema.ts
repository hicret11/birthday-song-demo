import { z } from "zod";

// Karaoke caption line: text plus millisecond start/end relative to the audio.
export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

// Share templates mirror the Next app's SHARE_TEMPLATES union.
export const shareTemplateSchema = z.enum([
  "classic",
  "neon",
  "elegant",
  "playful",
  "corporate",
]);

// Input props for the BirthdaySong composition. Kept in sync with the payload
// the Next app's render worker POSTs (lib/render-video.ts → { song, captions }).
export const birthdaySongSchema = z.object({
  name: z.string(),
  senderName: z.string().optional(),
  personalNote: z.string().optional(),
  // Must be an https URL — Remotion fetches it in headless Chromium.
  audioSrc: z.string(),
  theme: shareTemplateSchema,
  // Deluxe photo montage (Ken-Burns) behind a scrim. Optional.
  photoUrls: z.array(z.string()).optional(),
  watermark: z.string().default("singmybirthday.com"),
  captions: z.array(captionSchema).default([]),
  language: z.string().default("English"),
});

export type BirthdaySongProps = z.infer<typeof birthdaySongSchema>;
export type Caption = z.infer<typeof captionSchema>;
export type ShareTemplate = z.infer<typeof shareTemplateSchema>;

// ── The Premiere video (Phase D) — the deliverable IS the premiere ─────────────
// Aspect: "16:9" (default, projectable/YouTube) or "9:16" (stories/reels). The
// composition reflows per aspect via useVideoConfig, so one component serves both.
export const premiereAspectSchema = z.enum(["16:9", "9:16"]);

export const premiereVideoSchema = z.object({
  name: z.string(),
  /** "Produced & directed by" credit — a name or a relationship ("their partner"). */
  directorName: z.string().optional(),
  // https URL — Remotion fetches it in headless Chromium.
  audioSrc: z.string(),
  /** Director's voice note, appended after the song when present. */
  noteAudioSrc: z.string().optional(),
  /** Director's written note, shown on the closing card. */
  directorNoteText: z.string().optional(),
  theme: shareTemplateSchema.default("classic"),
  photoUrls: z.array(z.string()).optional(),
  /** Crowd contributor names for the credits roll. */
  contributors: z.array(z.string()).default([]),
  watermark: z.string().default("singmybirthday.com"),
  language: z.string().default("English"),
  aspect: premiereAspectSchema.default("16:9"),
  // Localized credit/labels (fed from the Next app dictionary at render time).
  starringLabel: z.string().default("Starring"),
  producedByLabel: z.string().default("Produced & directed by"),
  withLoveLabel: z.string().default("With love from"),
  noteLabel: z.string().default("A message from the director"),
  // Resolved by calculateMetadata (probed audio lengths) — not sent by callers.
  songDurationSec: z.number().default(0),
  noteDurationSec: z.number().default(0),
});

export type PremiereVideoProps = z.infer<typeof premiereVideoSchema>;
export type PremiereAspect = z.infer<typeof premiereAspectSchema>;
