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
