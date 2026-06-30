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



export const SHARE_TEMPLATES = ["classic", "neon", "elegant", "playful"] as const;
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
  /** Pricing tier resolved from geo/IP at creation; drives the unlock price. */
  tier?: "A" | "B" | "C";
  /** User-uploaded photo URLs (R2) for the optional paid photo slideshow. */
  photoUrls?: string[];
  /** Rendered photo-slideshow MP4 (R2 URL), produced after unlock. */
  slideshowVideoUrl?: string;
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
