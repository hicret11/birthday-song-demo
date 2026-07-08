import type { Delivery } from "./delivery";

export type LyricSectionTag = "Verse" | "Chorus" | "Bridge" | "Outro";

export type LyricSection = {
  tag: LyricSectionTag;
  lines: string[];
};

export type Lyrics = {
  title: string;
  sections: LyricSection[];
  raw: string;
  style: string;
  language: string;
};

export const LANGUAGES = ["English", "Turkish", "Spanish", "French", "Arabic", "Hindi", "Russian"] as const;
export type Language = (typeof LANGUAGES)[number];

export const GENRES = [
  "🎤 Pop",
  "🎷 R&B",
  "🎸 Rock",
  "🎹 Jazz",
  "🎧 Hip-Hop",
  "🎛️ Electronic",
] as const;
export const SURPRISE_GENRE = "🎲 Surprise Me";
export type Genre = (typeof GENRES)[number];

export type GenerateSongRequest = {
  name: string;
  language: Language;
  genre: Genre | typeof SURPRISE_GENRE;
  relationship?: string;
  age?: string;
  profession?: string;
  memory?: string;
  extras?: string;
  /**
   * Optional phonetic spelling for tricky names. When present, the lyric
   * prompt instructs Claude to spell the name phonetically in the lyrics so
   * Suno's vocalist pronounces it correctly (e.g., "sha-VON" for Siobhan).
   */
  pronunciation_hint?: string;
  /**
   * Optional free-text style descriptor — subgenre, artist reference, mood,
   * BPM, anything Suno's style tag accepts. Concatenated with the primary
   * genre when sent to Suno and used to steer the lyric tone with Claude.
   * Example: "Afro house like Palm Monkey, upbeat tribal, ~120 BPM".
   */
  style_notes?: string;
  /**
   * Emotional target chosen during casting ("goosebumps", "happy tears"…).
   * Aims the lyric's emotional arc.
   */
  feeling?: string;
  /**
   * "Produced & directed by" credit — relationship role or sender name. Sets
   * the point of view the lyrics are written from.
   */
  director_credit?: string;
};

export type GenerateLyricsResponse = {
  lyrics: Lyrics;
  resolvedGenre: Genre;
};

export type GenerateMusicRequest = {
  lyrics: Lyrics;
  name: string;
  genre: string;
  language: string;
  /** Free-text style descriptor; appended to the Suno style tag. */
  style_notes?: string;
  /**
   * Optional phonetic spelling (e.g., "Ka-MEE-la" for Kamila). Applied as a
   * post-process word-boundary substitution on the Suno-bound lyric copy
   * ONLY — the lyrics persisted to KV and shown on /share/[id] keep the
   * original spelling.
   */
  pronunciation_hint?: string;
};

export type GenerateMusicResponse = {
  jobId: string;
  /**
   * Claude-refined Suno style descriptor when the user provided style_notes.
   * Returned so the client can forward it to /api/share for persistence —
   * the regenerate route reuses it instead of re-paying the Haiku call.
   * Absent when no style_notes were supplied or refinement failed (in which
   * case the route fell back to genre + raw notes concatenation).
   */
  refinedStyle?: string;
};

export type GenerateVideoRequest = {
  name: string;
  language: string;
  genre: string;
  relationship?: string;
  age?: string;
  profession?: string;
  memory?: string;
  extras?: string;
  lyricsTitle?: string;
};

export type GenerateVideoResponse = {
  videoJobId: string;
};



export const SHARE_TEMPLATES = ["classic", "neon", "elegant", "playful", "corporate"] as const;
export type ShareTemplate = (typeof SHARE_TEMPLATES)[number];

/**
 * Optional, additive data captured during the music-generation wait state.
 * Nothing here gates or delays song creation — values are simply persisted
 * alongside the share for downstream funnel analysis and re-engagement
 * (year-out reminder emails).
 */
export const WAIT_CAPTURE_RELATIONSHIPS = [
  "friend",
  "family",
  "partner",
  "colleague",
  "coworker",
  "other",
] as const;
export type WaitCaptureRelationship = (typeof WAIT_CAPTURE_RELATIONSHIPS)[number];

export const WAIT_CAPTURE_LOCATIONS = [
  "home",
  "party",
  "restaurant",
  "venue",
  "virtual",
  "other",
] as const;
export type WaitCaptureLocation = (typeof WAIT_CAPTURE_LOCATIONS)[number];

export type WaitCapture = {
  relationship?: WaitCaptureRelationship;
  celebration_location?: WaitCaptureLocation;
  year_reminder?: boolean;
};

/**
 * "Make it Yours" personalization — three optional fields filled in during
 * the music-generation wait. Cake and candle are closed enums; personal
 * note is a free-text caption that renders below the recipient's name in
 * the video.
 */
export const CAKE_STYLES = ["chocolate", "vanilla", "rainbow", "custom"] as const;
export type CakeStyle = (typeof CAKE_STYLES)[number];

export const CANDLE_COLORS = [
  "pink",
  "purple",
  "blue",
  "cyan",
  "green",
  "yellow",
  "orange",
  "red",
] as const;
export type CandleColor = (typeof CANDLE_COLORS)[number];

export const PERSONAL_NOTE_MAX_LEN = 80;

export type SharedSong = {
  id: string;
  name: string;
  language: string;
  genre: string;
  lyrics: Lyrics;
  audioUrl: string;
  videoUrl?: string;
  template: ShareTemplate;
  createdAt: number;
  senderName?: string;
  venueSlug?: string;
  venueName?: string;
  venueColor?: string;
  /**
   * Number of "Try another version" regenerations applied to this share.
   * Capped at MAX_REGEN_RETRIES on the server to bound cost. Missing on
   * legacy entries; treat as 0.
   */
  retryCount?: number;
  /**
   * Style descriptor used at generation time. Persisted so future "remake
   * with same style" features (and the existing regenerate endpoint) can
   * reuse it without round-tripping back to the form.
   */
  styleNotes?: string;
  /**
   * Claude-refined Suno descriptor derived from styleNotes. Stored so the
   * regenerate route can reuse the same precise prompt instead of paying for
   * another Haiku refinement when the user just wants a fresh take. Cleared
   * (or re-derived) if the retry UI overrides styleNotes.
   */
  refinedStyle?: string;
  /**
   * Phonetic spelling supplied at generation time (e.g., "Ka-MEE-la"). NOT
   * baked into the persisted lyrics — applied as a substitution on the
   * Suno-bound copy only. Stored so the regenerate endpoint applies the
   * same fix on retries without needing the user to re-enter it.
   */
  pronunciationHint?: string;
  /**
   * Optional fields captured during the music-generation wait state. Purely
   * additive — used for funnel analysis and year-out reminder targeting,
   * never surfaced on the share page.
   */
  waitCapture?: WaitCapture;
  /**
   * Recipient's birthday as a month-day "MM-DD" string (year stripped at
   * persist time). Optional and additive. When present alongside an opted-in
   * year_reminder and a buyer email, the share route enrolls the buyer in the
   * annual birthday-reminder sequence (see lib/birthday-reminders.ts). Never
   * surfaced on the share page.
   */
  birthdayDate?: string;
  /**
   * Birthday countdown delivery (giver-sends model). When mode is "scheduled",
   * the share page holds the premiere behind a locked countdown ticket until
   * `deliverAt` (9am local on the recipient's next birthday) — an ADDITIONAL
   * gate on top of the paywall, never a media leak. Absent/mode "now" = the
   * current instant-reveal behavior. See lib/delivery.ts.
   */
  delivery?: Delivery;
  /**
   * Unguessable token that lets the GIVER preview their own premiere before
   * `deliverAt` (via ?preview=<token>). Never included in the public share link.
   */
  previewToken?: string;
  /**
   * "Make it Yours" personalization picked during the wait. cakeStyle and
   * candleColor are closed enums; personalNote is free text capped at
   * PERSONAL_NOTE_MAX_LEN. Used by lib/video.ts to add a caption under the
   * recipient name (and reserved for future template-asset overlays).
   */
  cakeStyle?: CakeStyle;
  candleColor?: CandleColor;
  personalNote?: string;
  /**
   * Consumer monetization. A freshly created song is LOCKED: the buyer hears
   * only a short free preview until they complete one-time Stripe checkout.
   * The Stripe webhook (checkout.session.completed with
   * metadata.kind="song_unlock") flips `unlocked` to true, which opens full
   * audio, MP3 download, the branded share video, and the photo slideshow.
   * Missing on legacy/pre-paywall entries — treat absence as locked=false
   * ONLY for songs created before the paywall shipped (see PAYWALL_SINCE).
   */
  unlocked?: boolean;
  unlockedAt?: number;
  /**
   * Which plan the buyer purchased. "full" (Standard/Premiere) is the base
   * unlock; "deluxe" adds the photo-slideshow video; "production" adds the AI
   * character birthday call on top of Deluxe. Missing on legacy/pre-Deluxe
   * entries — treat absence as "full".
   */
  plan?: "full" | "deluxe" | "production";
  /** Pricing tier resolved from geo/IP at creation; drives the unlock price. */
  tier?: "A" | "B" | "C";
  /**
   * Audio highlight-cut (lib/audio-cut.ts). Suno always returns a full ~2–3
   * min repetitive track; at share-create we carve a tight ~55s highlight
   * (`highlightAudioUrl`) used ONLY as the video/audiogram + karaoke source and
   * as the basis for the 15s preview — NOT as the buyer's song. The buyer's
   * deliverable is the complete track: `fullAudioUrl` is our persisted R2 copy
   * of the untouched full-length recording (Suno tempfiles expire), and it is
   * what Standard playback + MP3 download serve. Both absent when the cut failed
   * or wasn't needed (short source), in which case the raw `audioUrl` is used.
   */
  highlightAudioUrl?: string;
  fullAudioUrl?: string;
  /** Duration (seconds, rounded) of highlightAudioUrl when present. */
  highlightDurationSec?: number;
  /**
   * ~15s free preview clip (R2). This is the ONLY audio a locked visitor can
   * fetch — the gated /api/share/[id]/preview route serves it, and the server
   * strips all full-media URLs from the locked client payload (see
   * lib/public-song.ts). Absent on legacy locked songs, in which case the
   * preview route lazily generates it.
   */
  previewAudioUrl?: string;
  /** User-uploaded photo URLs (R2) for the optional paid photo slideshow. */
  photoUrls?: string[];
  /**
   * Crowd voice-note audio URLs (Vercel Blob) folded in at merge time. Their
   * spoken words are transcribed into the lyrics; the audio is kept here for a
   * future voice montage. Crowd songs only; absent otherwise.
   */
  voiceUrls?: string[];
  /** Rendered photo-slideshow MP4 (R2 URL), produced after unlock. */
  slideshowVideoUrl?: string;
  /**
   * Word-level karaoke captions for the premium Remotion video. Produced by
   * lib/transcribe.ts (Whisper verbose_json word timings, reconciled against
   * the known lyrics) and persisted so the render worker can consume them
   * without re-transcribing. Grouped into short lines (≤6 words). Timings are
   * milliseconds relative to the start of the song audio. Best-effort — absent
   * when transcription failed or hasn't run yet.
   */
  captions?: { text: string; startMs: number; endMs: number }[];
  /**
   * Rendered premium Remotion video (R2 URL), produced by the separate render
   * worker after unlock. When present, the share page prefers this over the
   * ffmpeg-rendered `videoUrl`. Absent until the worker finishes (or if the
   * worker isn't configured — the ffmpeg `videoUrl` remains the shown video).
   */
  premiumVideoUrl?: string;
  /**
   * Lifecycle of the premium Remotion render. "pending" once a job is POSTed
   * to the worker, "ready" when premiumVideoUrl is set, "failed" on error.
   * Absent when no premium render was ever requested.
   */
  videoStatus?: "pending" | "ready" | "failed";
  /**
   * Crowd-magic state. Present only on gifts minted for collaborative songs
   * (POST /api/crowd/create), where the id exists BEFORE any song so the
   * recipient's circle can contribute lines/memories via /join/[id] first.
   * "collecting" → open for contributions; "closed" → collection ended;
   * "merged" → contributions woven into the generated song. Additive and
   * optional — solo songs never carry it, and existing readers ignore it.
   */
  crowd?: {
    status: "collecting" | "closed" | "merged";
    directorName?: string;
    closesAt?: number;
  };
  /**
   * v4 "Production Studio" fields. All additive/optional so legacy songs and
   * existing readers are unaffected.
   *
   * directorCredit — how the giver is credited in the premiere titles
   *   ("their partner", "their best friend"…). Distinct from senderName (the
   *   giver's actual name) and from waitCapture.relationship; this is the
   *   display credit shown on the premiere ("Produced by your partner").
   * feeling — the emotional target chosen in casting ("goosebumps", "laughing
   *   till they cry"…). Fed into lyric + Suno style so tone reflects intent.
   * directorNote — a private message from the giver revealed as the CLOSING
   *   beat of the premiere. `text` is shown on-screen; `voiceUrl` (Vercel Blob)
   *   is an optional spoken recording played after the song ends
   *   (voiceDurationSec is its rounded length). Either/both may be present.
   */
  directorCredit?: string;
  feeling?: string;
  directorNote?: {
    text?: string;
    voiceUrl?: string;
    voiceDurationSec?: number;
  };
};

export type ShareCreateRequest = {
  name: string;
  language: string;
  genre: string;
  lyrics: Lyrics;
  audioUrl: string;
  template: ShareTemplate;
  senderName?: string;
  venueSlug?: string;
  email?: string;
  /** Style descriptor used at generation time; persisted with the share. */
  style_notes?: string;
  /**
   * Claude-refined Suno descriptor returned by /api/generate-music. Forwarded
   * here so the share row can persist it for the regenerate route's reuse.
   */
  refined_style?: string;
  /**
   * Phonetic spelling for the recipient's name. Persisted on the share so
   * the regenerate endpoint can re-apply the substitution on retries.
   */
  pronunciation_hint?: string;
  /**
   * Optional capture from the wait-state UI. Empty/missing fields are fine —
   * doesn't block share creation.
   */
  wait_capture?: WaitCapture;
  /**
   * Optional recipient birthday for the annual reminder. Accepts "YYYY-MM-DD"
   * or "MM-DD"; the server extracts the month-day and drops anything invalid.
   * Purely additive — never blocks share creation. Only triggers enrollment
   * when paired with an opted-in year_reminder and a buyer email.
   */
  birthday_date?: string;
  /**
   * Countdown-delivery choice (giver-sends). mode "scheduled" holds the premiere
   * behind a countdown until the recipient's next birthday at 9am in `timezone`
   * (the giver's IANA browser zone); "now" reveals immediately. The server
   * computes the concrete deliverAt from birthday_date + timezone.
   */
  delivery?: { mode: "now" | "scheduled"; timezone?: string };
  /**
   * "Make it Yours" personalization. cake_style and candle_color must match
   * the closed enums; personal_note is free text and gets sanitized + capped
   * server-side.
   */
  cake_style?: CakeStyle;
  candle_color?: CandleColor;
  personal_note?: string;
  /**
   * Optional R2 photo URLs (https) captured before share creation for the
   * paid photo slideshow. Validated server-side (array of https URLs, max 6)
   * and persisted onto the SharedSong. Purely additive — never blocks share
   * creation. The slideshow itself is rendered later, after unlock.
   */
  photoUrls?: string[];
  /**
   * v4 "Production Studio" capture. All additive — never block share creation.
   * director_credit: display credit ("their partner"…). feeling: casting vibe.
   * director_note_text: typed closing message. director_note_voice_url: https
   * Blob URL of the recorded closing message (validated server-side);
   * director_note_voice_duration_sec its rounded length.
   */
  director_credit?: string;
  feeling?: string;
  director_note_text?: string;
  director_note_voice_url?: string;
  director_note_voice_duration_sec?: number;
};

export type ShareCreateResponse = {
  id: string;
  shareUrl: string;
  videoUrl?: string;
  /**
   * Resolved pricing tier of the requesting visitor. Surfaced for any
   * downstream surface (share page, follow-up upsells) that needs to render
   * tier-aware copy or pricing. See lib/pricing-tiers.ts for the resolution
   * rules. Always present.
   */
  tier: "A" | "B" | "C";
  /**
   * Countdown delivery, echoed back when the giver chose a scheduled premiere.
   * `deliverAt` is the UTC ISO reveal instant; `previewUrl` is the giver-only
   * link (carries the preview token) to see the premiere before then. Absent for
   * instant ("now") delivery.
   */
  deliverAt?: string;
  previewUrl?: string;
};

export type SongStatusResponse =
  | { status: "pending"; progress?: number }
  | { status: "complete"; audioUrl: string; durationSec?: number }
  | { status: "failed"; error: string };

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "LYRICS_FAILED"
  | "LYRICS_TIMEOUT"
  | "MUSIC_SUBMIT_FAILED"
  | "MUSIC_STATUS_FAILED"
  | "MISSING_JOB_ID"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "NOT_FOUND"
  | "SHARE_STORE_FAILED"
  | "VIDEO_RENDER_FAILED";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
