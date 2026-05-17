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
};

export type GenerateMusicResponse = {
  jobId: string;
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

export type SharedSong = {
  id: string;
  name: string;
  language: string;
  genre: string;
  lyrics: Lyrics;
  audioUrl: string;
  template: ShareTemplate;
  createdAt: number;
};

export type ShareCreateRequest = {
  name: string;
  language: string;
  genre: string;
  lyrics: Lyrics;
  audioUrl: string;
  template: ShareTemplate;
};

export type ShareCreateResponse = {
  id: string;
  shareUrl: string;
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
  | "SHARE_STORE_FAILED";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
