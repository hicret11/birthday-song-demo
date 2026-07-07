// NOTE: file name is legacy. Lyric generation + style refinement now run on
// OpenAI (Responses API): structured outputs for reliable JSON, and the hosted
// web_search tool for niche music references. The exported function names are
// unchanged so call sites don't move. (Anthropic is no longer used here.)
import OpenAI from "openai";
import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";
import { env } from "./env";
import type { LyricSection, LyricSectionTag, Lyrics } from "./api-types";

export type { Lyrics, LyricSection, LyricSectionTag };

export type LyricsInput = {
  name: string;
  language: string;
  genre: string;
  relationship?: string;
  age?: string;
  profession?: string;
  memory?: string;
  extras?: string;
  /** Free-text style descriptor — guides lyric tone/energy/vocabulary. */
  styleNotes?: string;
};

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: env.openaiApiKey });
  return openaiClient;
}

const SYSTEM_PROMPT = `You are a professional birthday song lyricist who writes warm, personal, and singable lyrics in any language. You write lyrics natively in the target language — never translate from English. You respect cultural birthday traditions:
- Turkish: echoes of "İyi ki doğdun" / "Mutlu yıllar sana" cadences are welcome.
- Spanish: "Las Mañanitas" warmth, or "Cumpleaños Feliz" feel.
- French: "Joyeux Anniversaire" structure.
- Arabic: "كل عام وأنت بخير" / "سنة حلوة يا جميل" sensibility; use Modern Standard Arabic unless the genre calls for dialect.
- Hindi: "Janam Din Mubarak ho" / "Bar bar din ye aaye" feel; Devanagari script.
- Russian: "С днём рождения" warmth; the wistful celebratory mood of Krokodil Gena's birthday song ("Пусть бегут неуклюже...") is a welcome reference. Use Cyrillic script.
- English: modern singable; do NOT reuse the "Happy Birthday to You" copyrighted melody/lyrics.

You match the requested genre's lyrical conventions (Hip-Hop = rhyme density and flow, Jazz = imagery and intimacy, Pop = hooks and repetition, Rock = energy and anthems, R&B = emotion and groove, Electronic = chant-friendly and rhythmic).

NON-NEGOTIABLE: every song MUST contain an explicit, clearly sung "happy birthday" greeting addressed to the person, written in the target language — e.g. Spanish "Feliz cumpleaños", French "Joyeux anniversaire", Russian "С днём рождения", Arabic "كل عام وأنت بخير" / "عيد ميلاد سعيد", Turkish "İyi ki doğdun" / "Doğum günün kutlu olsun", Hindi "Janam din mubarak". A birthday song that never actually wishes a happy birthday has failed its only job. Put the greeting in the chorus so it is unmissable.

Honor every specific detail the user gives (nicknames, hobbies, memories, requested phrases) — if they ask you to work in a particular word or fact, include it.`;

// Strict JSON Schema for OpenAI Structured Outputs. `strict: true` guarantees
// the model returns valid JSON matching this shape, so the old parse/retry
// dance is gone. All properties are required and additionalProperties is false
// (both mandatory for strict mode).
const LYRICS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "style", "sections"],
  properties: {
    title: { type: "string", description: "Short song title in the target language." },
    style: {
      type: "string",
      description:
        "1-2 sentence ENGLISH description of genre + mood for the music model (e.g. 'upbeat pop with warm acoustic guitar and bright vocals').",
    },
    sections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tag", "lines"],
        properties: {
          tag: { type: "string", enum: ["Verse", "Chorus", "Bridge", "Outro"] },
          lines: { type: "array", minItems: 1, items: { type: "string" } },
        },
      },
    },
  },
};

function stripEmojiPrefix(genre: string): string {
  return genre.replace(/^[^\p{L}]+/u, "").trim() || genre;
}

function buildUserMessage(input: LyricsInput): string {
  const genreClean = stripEmojiPrefix(input.genre);
  const advancedLines: string[] = [];
  if (input.relationship?.trim()) advancedLines.push(`- Their relationship to the writer: ${input.relationship.trim()}`);
  if (input.age?.trim()) advancedLines.push(`- Age they are turning: ${input.age.trim()}`);
  if (input.profession?.trim()) advancedLines.push(`- Their profession: ${input.profession.trim()}`);
  if (input.memory?.trim()) advancedLines.push(`- A special shared memory: ${input.memory.trim()}`);
  if (input.extras?.trim()) advancedLines.push(`- Anything else: ${input.extras.trim()}`);

  const advancedBlock = advancedLines.length > 0 ? `\n${advancedLines.join("\n")}` : "";

  const styleNotesLine = input.styleNotes?.trim()
    ? `\n- Style notes: ${input.styleNotes.trim()} (let this guide the lyrics' tone, energy, and vocabulary — match the requested mood, and weave in any specific words/facts requested)`
    : "";

  // NOTE: No pronunciation instruction is included in the lyric prompt.
  // The name is always written using its original spelling. The pronunciation
  // form is applied as a post-process string substitution ONLY on the
  // Suno-bound copy (see applyPronunciationHint below) so the displayed lyrics
  // on /share/[id] never show the phonetic form.

  return `Write a personalized birthday song with these inputs:

- Name: ${input.name}
- Language: ${input.language} (write all lyrics in this language)
- Genre: ${genreClean}${styleNotesLine}${advancedBlock}

Constraints:
- Total length: A complete, full song of about 60 seconds — roughly 8 to 12 lines: a verse, a chorus that clearly wishes them a happy birthday and lands their name, and a short bridge or a repeat of the chorus to finish. Keep every line singable and tight — a real full song, not a 30-second snippet, but no long intros, outros, or filler.
- MANDATORY: the lyrics MUST explicitly wish ${input.name} a happy birthday in ${input.language} (the natural local phrase, e.g. Spanish "Feliz cumpleaños", French "Joyeux anniversaire", Russian "С днём рождения", Arabic "كل عام وأنت بخير", Turkish "İyi ki doğdun", Hindi "Janam din mubarak"). This greeting must appear in the chorus — it is the entire point of the song and must never be omitted, no matter what other theme (a team welcome, a tribute, an inside joke) the inputs suggest.
- Use ${input.name} in the chorus and ideally in the verse too.
- Reference the advanced fields and style notes naturally if provided.
- Never include English placeholder text in non-English lyrics.`;
}

type LyricsRaw = {
  title: unknown;
  sections: unknown;
  style: unknown;
};

function validateAndNormalize(parsed: LyricsRaw): { title: string; sections: LyricSection[]; style: string } {
  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new Error("lyrics response missing 'title'");
  }
  if (typeof parsed.style !== "string" || !parsed.style.trim()) {
    throw new Error("lyrics response missing 'style'");
  }
  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("lyrics response missing 'sections'");
  }

  const allowedTags: LyricSectionTag[] = ["Verse", "Chorus", "Bridge", "Outro"];
  const sections: LyricSection[] = parsed.sections.map((s: unknown, idx: number) => {
    if (!s || typeof s !== "object") {
      throw new Error(`Section ${idx} is not an object`);
    }
    const obj = s as { tag?: unknown; lines?: unknown };
    if (typeof obj.tag !== "string" || !allowedTags.includes(obj.tag as LyricSectionTag)) {
      throw new Error(`Section ${idx} has invalid tag: ${obj.tag}`);
    }
    if (!Array.isArray(obj.lines) || obj.lines.length === 0) {
      throw new Error(`Section ${idx} has no lines`);
    }
    const lines = obj.lines.map((line: unknown, lineIdx: number) => {
      if (typeof line !== "string") {
        throw new Error(`Section ${idx} line ${lineIdx} is not a string`);
      }
      return line;
    });
    return { tag: obj.tag as LyricSectionTag, lines };
  });

  return { title: parsed.title.trim(), sections, style: parsed.style.trim() };
}

const ALLOWED_TAGS: LyricSectionTag[] = ["Verse", "Chorus", "Bridge", "Outro"];

export function normalizeClientLyrics(raw: unknown): Lyrics {
  if (!raw || typeof raw !== "object") {
    throw new Error("lyrics must be an object");
  }
  const obj = raw as Partial<Lyrics>;

  if (typeof obj.title !== "string" || !obj.title.trim()) {
    throw new Error("lyrics.title is required");
  }
  if (typeof obj.style !== "string" || !obj.style.trim()) {
    throw new Error("lyrics.style is required");
  }
  if (typeof obj.language !== "string" || !obj.language.trim()) {
    throw new Error("lyrics.language is required");
  }
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    throw new Error("lyrics.sections must be a non-empty array");
  }

  const sections: LyricSection[] = obj.sections.map((section, idx) => {
    if (!section || typeof section !== "object") {
      throw new Error(`lyrics.sections[${idx}] must be an object`);
    }
    const s = section as { tag?: unknown; lines?: unknown };
    if (typeof s.tag !== "string" || !ALLOWED_TAGS.includes(s.tag as LyricSectionTag)) {
      throw new Error(`lyrics.sections[${idx}].tag is invalid`);
    }
    if (!Array.isArray(s.lines)) {
      throw new Error(`lyrics.sections[${idx}].lines must be an array`);
    }
    const lines = s.lines
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      throw new Error(`lyrics.sections[${idx}] has no non-empty lines`);
    }
    return { tag: s.tag as LyricSectionTag, lines };
  });

  return {
    title: obj.title.trim(),
    style: obj.style.trim(),
    language: obj.language.trim(),
    sections,
    raw: buildRawLyrics(sections),
  };
}

export function buildRawLyrics(sections: LyricSection[]): string {
  const counters: Record<LyricSectionTag, number> = { Verse: 0, Chorus: 0, Bridge: 0, Outro: 0 };
  const totals: Record<LyricSectionTag, number> = { Verse: 0, Chorus: 0, Bridge: 0, Outro: 0 };
  for (const s of sections) totals[s.tag] += 1;

  return sections
    .map((s) => {
      counters[s.tag] += 1;
      const needsNumber = totals[s.tag] > 1;
      const header = needsNumber ? `[${s.tag} ${counters[s.tag]}]` : `[${s.tag}]`;
      return `${header}\n${s.lines.join("\n")}`;
    })
    .join("\n\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a Suno-bound copy of a lyric text by replacing every occurrence of
 * the recipient's name with the user-supplied pronunciation hint. The
 * substitution is case-insensitive and word-boundary anchored — "Kamila"
 * matches "Kamila!" and "Kamila's" but not the middle of an unrelated word.
 *
 * The output is sent to Suno's lyric tokenizer only; the displayed lyrics
 * on /share/[id] continue to use the original spelling.
 *
 * Returns the input text unchanged when either argument is empty/blank, or
 * when the name doesn't appear in the text (e.g., Cyrillic-script lyric where
 * the name was transliterated — we don't try to match across scripts).
 */
export function applyPronunciationHint(args: {
  text: string;
  name: string;
  hint?: string | null;
}): string {
  if (!args.text) return args.text;
  const name = args.name?.trim();
  const hint = args.hint?.trim();
  if (!name || !hint) return args.text;
  if (name.toLowerCase() === hint.toLowerCase()) return args.text;
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi");
  return args.text.replace(pattern, hint);
}

/**
 * Translate the user's free-text "style notes" into a precise Suno style
 * descriptor. The model interprets references like "Afro house like Palm
 * Monkey's AWGAZI" into something Suno can match — specific subgenre, BPM,
 * mood, and instrumentation. When it doesn't recognize a reference, it can use
 * the hosted web_search tool to pull real metadata instead of guessing.
 *
 * Hard timeout so a slow search can't pin the generate-music route. KV cache
 * makes repeat lookups of the same notes essentially free.
 *
 * Callers own the empty-input guard and the fall-back-on-error pattern; this
 * function throws on any failure so the caller can degrade silently.
 */
export type RefineStyleInput = {
  genre: string;
  styleNotes: string;
  recipientName: string;
};

const REFINE_OUTPUT_MAX_CHARS = 180;
const REFINE_TIMEOUT_MS = 12_000;
const REFINE_MAX_OUTPUT_TOKENS = 2_000;
const REFINE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function refineCacheKey(genre: string, styleNotes: string): string {
  const cleanGenre = stripEmojiPrefix(genre).toLowerCase().trim();
  const normalizedNotes = styleNotes
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
  const hash = createHash("sha256")
    .update(`${cleanGenre}|${normalizedNotes}`)
    .digest("hex")
    .slice(0, 32);
  return `cache:style:${hash}`;
}

function tidyDescriptor(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim()
    .slice(0, REFINE_OUTPUT_MAX_CHARS);
}

export async function refineStyleForSuno(input: RefineStyleInput): Promise<string> {
  const cleanGenre = stripEmojiPrefix(input.genre);
  const userNotes = input.styleNotes.trim();
  if (!userNotes) {
    throw new Error("refineStyleForSuno requires non-empty styleNotes");
  }

  const cacheKey = refineCacheKey(input.genre, userNotes);
  try {
    const cached = await kv.get<string>(cacheKey);
    if (cached && typeof cached === "string" && cached.length > 0) {
      console.log(`[refine-style] cache hit key=${cacheKey.slice(0, 24)}…`);
      return cached;
    }
  } catch (err) {
    console.warn("[refine-style] cache read failed; falling through:", err);
  }

  const prompt = `You are translating a music request into a precise prompt for the Suno API.

Primary genre: ${cleanGenre}
User's style notes: "${userNotes}"

Translate the user's intent into a concise Suno style descriptor (max ${REFINE_OUTPUT_MAX_CHARS} chars).

If the user references a specific song, artist, or niche subgenre:
- If you recognize it, use that knowledge directly.
- If you don't recognize it, use the web_search tool ONCE to look it up (e.g., query: "{name} genre BPM tempo").
- Read the results to identify the actual genre, subgenre, tempo, and mood.

Otherwise (just generic mood/genre words), skip search and reply from your own knowledge.

Output ONLY the descriptor string. Format guideline:
"{subgenre}, ~{bpm} BPM, {mood/energy}, {1-2 instrumental hints}, {artist style if applicable}"

No preamble, no quotes, no explanation.`;

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), REFINE_TIMEOUT_MS);

  let usedWebSearch = false;
  let descriptor: string;
  try {
    const client = getOpenAI();
    const result = await client.responses.create(
      {
        model: env.openaiRefineModel,
        input: prompt,
        tools: [{ type: "web_search" }],
        reasoning: { effort: "low" },
        max_output_tokens: REFINE_MAX_OUTPUT_TOKENS,
      },
      { signal: abort.signal },
    );

    descriptor = tidyDescriptor(result.output_text ?? "");
    if (!descriptor) {
      throw new Error("OpenAI refine returned empty descriptor");
    }
    usedWebSearch = result.output.some((item) => item.type === "web_search_call");
  } finally {
    clearTimeout(timeout);
  }

  console.log(`[refine-style] refined web_search=${usedWebSearch} key=${cacheKey.slice(0, 24)}…`);

  try {
    await kv.set(cacheKey, descriptor, { ex: REFINE_CACHE_TTL_SECONDS });
  } catch (err) {
    console.warn("[refine-style] cache write failed:", err);
  }

  return descriptor;
}

const LYRICS_MAX_OUTPUT_TOKENS = 4_000;

export async function generateLyrics(input: LyricsInput): Promise<Lyrics> {
  const client = getOpenAI();

  const result = await client.responses.create({
    model: env.openaiLyricsModel,
    instructions: SYSTEM_PROMPT,
    input: buildUserMessage(input),
    // Structured Outputs — the model is constrained to this schema, so the
    // JSON is always valid and parseable (no fenced-code / prose failure mode).
    text: {
      format: {
        type: "json_schema",
        name: "birthday_lyrics",
        strict: true,
        schema: LYRICS_JSON_SCHEMA,
      },
    },
    // Low reasoning effort: this is a short creative task, not a reasoning
    // problem — keeps latency and cost down while still using the stronger model.
    reasoning: { effort: "low" },
    max_output_tokens: LYRICS_MAX_OUTPUT_TOKENS,
  });

  const text = result.output_text;
  if (!text || !text.trim()) {
    throw new Error(
      `OpenAI returned no lyrics text (status=${result.status ?? "unknown"})`,
    );
  }

  const parsed = JSON.parse(text) as LyricsRaw;
  const { title, sections, style } = validateAndNormalize(parsed);
  return {
    title,
    sections,
    raw: buildRawLyrics(sections),
    style,
    language: input.language,
  };
}
