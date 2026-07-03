// Word-timing transcription for premium karaoke captions.
//
// transcribeWordTimings downloads the song audio, runs OpenAI Whisper with
// `response_format: "verbose_json"` + `timestamp_granularities: ["word"]` to get
// per-word timestamps, then RECONCILES the ASR words against the KNOWN lyrics
// (the copy we generated and persisted) so misheard words are corrected while
// the audio-accurate timings are preserved. Finally it groups the corrected
// words into short caption lines (≤6 words) for a clean karaoke layout.
//
// Server-only. Best-effort: returns `null` on any failure so callers can fall
// back to the ffmpeg video with no captions. Reuses OPENAI_API_KEY and the same
// `openai` SDK the rest of the app uses.

import OpenAI, { toFile } from "openai";

export type Caption = { text: string; startMs: number; endMs: number };

/** Max words per rendered caption line — keeps karaoke lines readable. */
const MAX_WORDS_PER_LINE = 6;
/** A gap larger than this between words starts a new caption line. */
const LINE_GAP_MS = 700;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper's per-file ceiling.

const WHISPER_MODEL = process.env.OPENAI_WHISPER_MODEL ?? "whisper-1";

type WhisperWord = { word: string; start: number; end: number };

/** Loose shape of the verbose_json response we care about. */
type VerboseTranscription = {
  text?: string;
  words?: WhisperWord[];
};

/** Normalize a token for fuzzy matching: lowercase, strip punctuation/diacritics. */
function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Levenshtein distance, capped early — used to gauge word similarity. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity ratio in [0,1]; 1 = identical after normalization. */
function similarity(a: string, b: string): number {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const dist = editDistance(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** Flatten the known lyrics into an ordered token list (words only). */
function lyricsToTokens(knownLyrics: string): string[] {
  return knownLyrics
    .replace(/\[[^\]]*\]/g, " ") // strip section tags like [Chorus]
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Reconcile ASR words against the known lyric tokens. We keep the ASR timings
 * (audio truth) but swap in the lyric spelling whenever a lyric token lines up
 * with the ASR word — correcting spelling/homophone errors without drifting off
 * the true audio position.
 *
 * Alignment is a lightweight greedy forward-scan: for each ASR word we look at a
 * small window of upcoming lyric tokens and take the best fuzzy match, only
 * advancing the lyric cursor when a match is confident. This tolerates ASR
 * insertions/deletions (repeats, "oh"s, dropped filler) gracefully.
 */
function reconcileWords(asr: WhisperWord[], lyricTokens: string[]): WhisperWord[] {
  if (lyricTokens.length === 0) return asr;
  const out: WhisperWord[] = [];
  let cursor = 0;
  const LOOKAHEAD = 4;
  const CONFIDENT = 0.6;

  for (const w of asr) {
    let bestIdx = -1;
    let bestScore = 0;
    const end = Math.min(cursor + LOOKAHEAD, lyricTokens.length);
    for (let i = cursor; i < end; i += 1) {
      const score = similarity(w.word, lyricTokens[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestScore >= CONFIDENT) {
      // Confident match — adopt the lyric spelling, keep the ASR timing, and
      // advance the cursor past the matched token (skipping any lyric tokens
      // the ASR dropped in between).
      out.push({ word: lyricTokens[bestIdx], start: w.start, end: w.end });
      cursor = bestIdx + 1;
    } else {
      // No confident lyric token — keep the ASR word as-is (e.g. an ad-lib the
      // lyrics don't contain). Don't advance the cursor.
      out.push({ word: w.word, start: w.start, end: w.end });
    }
  }
  return out;
}

/** Group timed words into caption lines: ≤MAX_WORDS_PER_LINE, split on gaps. */
function groupIntoLines(words: WhisperWord[]): Caption[] {
  const lines: Caption[] = [];
  let bucket: WhisperWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const text = bucket
      .map((w) => w.word.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.!?])/g, "$1");
    if (text) {
      lines.push({
        text,
        startMs: Math.max(0, Math.round(bucket[0].start * 1000)),
        endMs: Math.max(0, Math.round(bucket[bucket.length - 1].end * 1000)),
      });
    }
    bucket = [];
  };

  for (const w of words) {
    if (bucket.length > 0) {
      const gapMs = (w.start - bucket[bucket.length - 1].end) * 1000;
      if (bucket.length >= MAX_WORDS_PER_LINE || gapMs > LINE_GAP_MS) flush();
    }
    bucket.push(w);
  }
  flush();
  return lines;
}

async function downloadAudio(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_AUDIO_BYTES) {
      throw new Error(`download size out of range: ${buf.length}`);
    }
    return buf;
  } catch (err) {
    console.error("[transcribe] audio download failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fileExtFromUrl(url: string): string {
  const match = /\.([a-z0-9]{2,4})(?:\?|#|$)/i.exec(url);
  const ext = match?.[1]?.toLowerCase();
  return ext && ["mp3", "wav", "m4a", "mp4", "ogg", "webm", "flac"].includes(ext) ? ext : "mp3";
}

/**
 * Transcribe `audioUrl` to word-timed captions, reconciled against
 * `knownLyrics`. Best-effort — returns `null` on any failure (missing API key,
 * download error, ASR failure, no words). Never throws.
 */
export async function transcribeWordTimings(
  audioUrl: string,
  knownLyrics: string,
): Promise<Caption[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[transcribe] OPENAI_API_KEY not set — skipping word timing.");
    return null;
  }

  const audio = await downloadAudio(audioUrl);
  if (!audio) return null;

  const openai = new OpenAI({ apiKey });
  let verbose: VerboseTranscription;
  try {
    const ext = fileExtFromUrl(audioUrl);
    const file = await toFile(audio, `song.${ext}`, { type: `audio/${ext === "m4a" ? "mp4" : ext}` });
    // The SDK types `response_format` narrowly; verbose_json + word granularity
    // is a valid Whisper combination, so we assert the richer response shape.
    const result = (await openai.audio.transcriptions.create({
      file,
      model: WHISPER_MODEL,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    })) as unknown as VerboseTranscription;
    verbose = result;
  } catch (err) {
    console.error("[transcribe] whisper failed:", err instanceof Error ? err.message : err);
    return null;
  }

  const words = (verbose.words ?? []).filter(
    (w) => typeof w.start === "number" && typeof w.end === "number" && w.end >= w.start,
  );
  if (words.length === 0) {
    console.warn("[transcribe] no word timestamps returned.");
    return null;
  }

  const lyricTokens = lyricsToTokens(knownLyrics ?? "");
  const reconciled = reconcileWords(words, lyricTokens);
  const lines = groupIntoLines(reconciled);
  return lines.length > 0 ? lines : null;
}
