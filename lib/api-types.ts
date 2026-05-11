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

export const LANGUAGES = ["English", "Turkish", "Spanish", "French", "Arabic", "Hindi"] as const;
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

export type GenerateSongResponse = {
  jobId: string;
  lyrics: Lyrics;
  resolvedGenre: Genre;
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
  | "INTERNAL";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
