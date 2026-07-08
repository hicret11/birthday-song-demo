// Transcribe a short audio clip from a public URL to text (OpenAI whisper-1).
//
// Reuses the proven Whisper path from /api/transcribe-name (whisper handles
// webm/mp4/ogg/wav/mp3 natively, so no ffmpeg conversion is needed here). Used
// at crowd merge time to turn voice-note contributions into words that shape the
// lyrics. Best-effort by design: returns "" on any failure (missing key,
// network, bad audio) so a single bad clip never blocks the merge.

import OpenAI, { toFile } from "openai";

// Full language name (as stored on a gift) → ISO code Whisper accepts. Unknown
// languages are left undefined so Whisper auto-detects.
const LANGUAGE_CODE: Record<string, string> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
  French: "fr",
  German: "de",
  Portuguese: "pt",
  Italian: "it",
  Hindi: "hi",
};

const MAX_AUDIO_BYTES = 6 * 1024 * 1024; // guard against an unexpectedly large blob
const MAX_TRANSCRIPT_LEN = 500;

function extFromUrl(url: string): string {
  const m = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(url);
  return m ? m[1].toLowerCase() : "webm";
}

/**
 * Fetch the audio at `url` and transcribe it. Returns trimmed text, or "" when
 * transcription isn't possible (no OPENAI_API_KEY, fetch/whisper error, empty
 * result). Never throws. `language` is the gift's full language name.
 */
export async function transcribeFromUrl(url: string, language?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[transcribe-audio] fetch ${res.status} for ${url}`);
      return "";
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_AUDIO_BYTES) return "";

    const contentType = res.headers.get("content-type") || "audio/webm";
    const file = await toFile(buf, `voice.${extFromUrl(url)}`, { type: contentType });

    const openai = new OpenAI({ apiKey });
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
      ...(language && LANGUAGE_CODE[language] ? { language: LANGUAGE_CODE[language] } : {}),
    });
    const text = typeof result === "string" ? result : (result as { text?: string }).text ?? "";
    return text.trim().slice(0, MAX_TRANSCRIPT_LEN);
  } catch (err) {
    console.warn("[transcribe-audio] failed:", err instanceof Error ? err.message : err);
    return "";
  }
}
