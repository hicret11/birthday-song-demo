// Name-pronunciation transcription — hybrid pipeline.
//
// Primary: `gpt-audio-1.5` (one-shot audio chat). The original
// `gpt-4o-audio-preview` was retired; among the current `gpt-audio*` family
// only `gpt-audio-1.5` will actually follow audio-listening instructions.
// When it works, latency is ~1s and the response is exactly what we want
// ("sha-VON" for Siobhan).
//
// The catch: gpt-audio-1.5 is empirically inconsistent — some calls return
// empty, some refuse on safety grounds ("I can't identify voices"), some
// silently ignore the audio block ("please provide the audio file"). The
// model behaves like the audio block is sometimes dropped.
//
// Fallback: Whisper transcribes the raw audio to text, then Claude Haiku
// converts the text to phonetic. Slower (~2-3s total) but rock-solid.
//
// Privacy: raw audio lives in a temp directory for ~1s of ffmpeg work, then
// is deleted in a `finally`. Nothing is persisted or logged with payloads.

import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import OpenAI, { toFile } from "openai";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const PRIMARY_MODEL = process.env.OPENAI_AUDIO_MODEL ?? "gpt-audio-1.5";
const PHONETIC_MODEL = process.env.OPENAI_REFINE_MODEL ?? "gpt-5-mini";

const ONE_SHOT_PROMPT =
  "Listen to this audio and write the name phonetically the way a singer should say it — e.g., 'sha-VON' for Siobhan. Output only the phonetic spelling, nothing else.";

function bad(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

function extensionFromMime(mime: string): string {
  if (!mime) return "bin";
  if (/webm/i.test(mime)) return "webm";
  if (/mp4|m4a|aac/i.test(mime)) return "mp4";
  if (/ogg/i.test(mime)) return "ogg";
  if (/wav/i.test(mime)) return "wav";
  if (/mp3|mpeg/i.test(mime)) return "mp3";
  return "bin";
}

async function convertToWav(input: Buffer, srcExt: string): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), `mic-${randomUUID()}-`));
  const inPath = path.join(workDir, `in.${srcExt}`);
  const outPath = path.join(workDir, "out.wav");
  try {
    await writeFile(inPath, input);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .audioCodec("pcm_s16le")
        .audioChannels(1)
        .audioFrequency(16000)
        .format("wav")
        .on("error", (err: Error) => reject(err))
        .on("end", () => resolve())
        .save(outPath);
    });
    return await readFile(outPath);
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function cleanPhonetic(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .split(/\r?\n/)[0]
    .slice(0, 80)
    .trim();
}

/**
 * Detects when gpt-audio-1.5 returned text that suggests it didn't actually
 * process the audio, or refused on safety grounds. Triggers fallback.
 */
function looksLikeNonAnswer(text: string): boolean {
  if (!text) return true;
  if (text.length > 50) return true;
  // Structured-data leak — model occasionally emits a JSON-shaped response
  // instead of a plain phonetic string (e.g. `{"audio_analysis_request":...}`).
  if (/[{}[\]:]/.test(text)) return true;
  // A real phonetic spelling is mostly letters, hyphens, apostrophes, spaces.
  // Anything else (digits, brackets, semicolons, etc.) is probably garbage.
  if (/[^A-Za-z\-'’\s]/.test(text)) return true;
  const lower = text.toLowerCase();
  const refusalSignals = [
    "i can't",
    "i cannot",
    "i'm sorry",
    "i am sorry",
    "please provide",
    "ready to listen",
    "give me the",
    "send the",
    "share the",
    "could you provide",
    "no audio",
    "i don't have",
    "identify",
    "audio file",
    "audio clip",
    "as an ai",
  ];
  return refusalSignals.some((s) => lower.includes(s));
}

async function tryOneShot(
  openai: OpenAI,
  wavBuffer: Buffer,
): Promise<string | null> {
  try {
    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      modalities: ["text"],
      max_tokens: 60,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ONE_SHOT_PROMPT },
            {
              type: "input_audio",
              input_audio: {
                data: wavBuffer.toString("base64"),
                format: "wav",
              },
            },
          ],
        },
      ],
    });
    const raw = result.choices[0]?.message?.content;
    const text = typeof raw === "string" ? raw : "";
    const phonetic = cleanPhonetic(text);
    if (looksLikeNonAnswer(phonetic)) return null;
    return phonetic;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "openai chat failed";
    console.warn("[transcribe-name] one-shot failed, falling back:", msg);
    return null;
  }
}

async function fallbackWhisperPlusLLM(
  openai: OpenAI,
  audio: Blob,
  filename: string,
): Promise<string | null> {
  let transcript = "";
  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    const file = await toFile(buffer, filename, { type: audio.type || "audio/webm" });
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
      language: "en",
    });
    const raw = typeof result === "string" ? result : (result as { text?: string }).text ?? "";
    transcript = raw.trim();
  } catch (err) {
    console.error("[transcribe-name] whisper fallback failed:", err);
    return null;
  }
  if (!transcript) return null;

  try {
    const result = await openai.responses.create({
      model: PHONETIC_MODEL,
      instructions:
        "You convert transcribed names into phonetic spellings a singer can read. Output only the phonetic spelling — no prose.",
      input: `A user said a name aloud and we transcribed it as: "${transcript}".\n\nWrite the name phonetically the way a singer should say it — e.g., "sha-VON" for Siobhan, "KAY-tlin" for Caitlin, "EE-fa" for Aoife. Output ONLY the phonetic spelling on a single line.`,
      reasoning: { effort: "minimal" },
      max_output_tokens: 200,
    });
    const phonetic = cleanPhonetic(result.output_text ?? "");
    return phonetic || transcript.slice(0, 80);
  } catch (err) {
    console.error("[transcribe-name] phonetic fallback failed:", err);
    return transcript.slice(0, 80);
  }
}

export async function POST(request: Request): Promise<Response> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return bad(
      "Voice pronunciation isn't set up yet — type the spelling instead.",
      503,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return bad("Invalid form data.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return bad("Audio is required.", 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return bad("Audio is too long. Try a shorter clip.", 413);
  }

  const srcExt = extensionFromMime(audio.type);
  const inBuffer = Buffer.from(await audio.arrayBuffer());

  let wavBuffer: Buffer;
  try {
    wavBuffer = srcExt === "wav" ? inBuffer : await convertToWav(inBuffer, srcExt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ffmpeg failed";
    console.error("[transcribe-name] convert failed:", msg);
    return bad("Couldn't process the audio. Try again or type it.", 502);
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Primary path — fast when it works.
  const oneShot = await tryOneShot(openai, wavBuffer);
  if (oneShot) {
    return Response.json({ phonetic: oneShot });
  }

  // Fallback — slower but reliable. We pass the original blob to whisper
  // (it handles many formats natively, so no re-conversion needed).
  const fallback = await fallbackWhisperPlusLLM(
    openai,
    audio,
    `recording.${srcExt}`,
  );
  if (fallback) {
    return Response.json({ phonetic: fallback });
  }

  return bad("Couldn't read the name. Try again or type it.", 502);
}
