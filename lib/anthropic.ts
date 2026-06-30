import Anthropic from "@anthropic-ai/sdk";
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

You output ONLY valid JSON matching the schema. No prose, no markdown fences.`;

const STRICT_RETRY_REMINDER = `Your previous response could not be parsed as JSON. Respond with valid JSON only — no prose, no markdown fences, no commentary before or after the JSON object.`;

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
    ? `\n- Style notes: ${input.styleNotes.trim()} (let this guide the lyrics' tone, energy, and vocabulary — match the requested mood)`
    : "";

  // NOTE: No pronunciation instruction is included in the lyric prompt.
  // Claude always writes the name using its original spelling. The
  // pronunciation form is applied as a post-process string substitution
  // ONLY on the Suno-bound copy (see applyPronunciationHint below) so the
  // displayed lyrics on /share/[id] never show the phonetic form.

  return `Write a personalized birthday song with these inputs:

- Name: ${input.name}
- Language: ${input.language} (write all lyrics in this language)
- Genre: ${genreClean}${styleNotesLine}${advancedBlock}

Output a JSON object exactly matching this schema:

{
  "title": "string — short, in the target language",
  "sections": [
    { "tag": "Verse" | "Chorus" | "Bridge" | "Outro", "lines": ["string", "..."] }
  ],
  "style": "string — 1-2 sentence English description of genre + mood for the music model (e.g. 'upbeat pop with warm acoustic guitar and bright vocals')"
}

Constraints:
- Total length: Exactly 4 short lines total, structured to feel complete in a 30 to 45 second song. Use the traditional birthday repetition pattern: 2 lines of verse, then 2 lines that resolve to the birthday person's name. No intro, no outro, no additional verses.
- MANDATORY: the lyrics MUST explicitly wish ${input.name} a happy birthday in ${input.language} (the natural local phrase, e.g. Spanish "Feliz cumpleaños", French "Joyeux anniversaire", Russian "С днём рождения", Arabic "كل عام وأنت بخير", Turkish "İyi ki doğdun", Hindi "Janam din mubarak"). This greeting must appear in the chorus — it is the entire point of the song and must never be omitted, no matter what other theme (a team welcome, a tribute, an inside joke) the inputs suggest.
- Use ${input.name} in the chorus and ideally in the verse too.
- Reference advanced fields naturally if provided.
- Never include English placeholder text in non-English lyrics.`;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

type ClaudeRaw = {
  title: unknown;
  sections: unknown;
  style: unknown;
};

function validateAndNormalize(parsed: ClaudeRaw): { title: string; sections: LyricSection[]; style: string } {
  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new Error("Claude response missing 'title'");
  }
  if (typeof parsed.style !== "string" || !parsed.style.trim()) {
    throw new Error("Claude response missing 'style'");
  }
  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("Claude response missing 'sections'");
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
 * on /share/[id] continue to use the original spelling. This is the fix
 * for the bug where lyrics rendered "kuh-MEE-luh" everywhere instead of
 * the user-typed "Kamila".
 *
 * Returns the input text unchanged when either argument is empty/blank, or
 * when the name doesn't appear in the text (e.g., Cyrillic-script lyric
 * where Claude transliterated the Latin name — we don't try to match
 * across scripts, the original Suno request just goes through as-is).
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

async function callClaude(client: Anthropic, userMessage: string, extraSystem?: string): Promise<string> {
  const result = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 500,
    temperature: 0.9,
    system: extraSystem ? `${SYSTEM_PROMPT}\n\n${extraSystem}` : SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = result.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  return block.text;
}

/**
 * Translate the user's free-text "style notes" into a precise Suno style
 * descriptor. Claude Haiku interprets references like "Afro house like Palm
 * Monkey's AWGAZI" into something Suno can match — specific subgenre, BPM,
 * mood, and instrumentation. When the user names something Claude doesn't
 * recognize from training, it can fire up to two web searches to pull real
 * metadata instead of guessing from name vibes.
 *
 * Latency budget: ~3s end-to-end (one search round-trip). Hard timeout 8s.
 * Cost: ~$0.0004 per call without search, ~$0.011 per call with one search.
 * KV cache makes the second hit on the same notes essentially free.
 *
 * Callers are responsible for the empty-input guard and the
 * fall-back-on-error pattern. This function itself throws on any failure so
 * the caller can decide whether to surface the error or degrade silently.
 */
export type RefineStyleInput = {
  genre: string;
  styleNotes: string;
  recipientName: string;
};

const REFINE_MAX_TOKENS = 250;
const REFINE_OUTPUT_MAX_CHARS = 180;
const REFINE_TIMEOUT_MS = 8_000;
const REFINE_WEB_SEARCH_MAX_USES = 2;
const REFINE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Cache key built from the genre + normalized notes. Same notes against a
// different primary genre is meaningfully different (the prompt anchors on
// the genre), so both go into the hash.
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
    // Strip leading/trailing matched quotes if the model ignored the instruction.
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    // Collapse newlines — Suno expects a single descriptor line.
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

  // KV cache check first. A cache hit serves a previously-refined descriptor
  // (no Claude call, no search) in sub-100ms — meaningful for trendy artist
  // names that lots of users type into the form.
  const cacheKey = refineCacheKey(input.genre, userNotes);
  try {
    const cached = await kv.get<string>(cacheKey);
    if (cached && typeof cached === "string" && cached.length > 0) {
      console.log(`[refine-style] cache hit key=${cacheKey.slice(0, 24)}…`);
      return cached;
    }
  } catch (err) {
    // KV unreachable — fall through to live call. We never want the cache
    // layer to be the blocker that takes refinement down.
    console.warn("[refine-style] cache read failed; falling through:", err);
  }

  const prompt = `You are translating a music request into a precise prompt for the Suno API.

Primary genre: ${cleanGenre}
User's style notes: "${userNotes}"

Translate the user's intent into a concise Suno style descriptor (max ${REFINE_OUTPUT_MAX_CHARS} chars).

If the user references a specific song, artist, or niche subgenre:
- If you recognize it from training, use that knowledge directly.
- If you don't recognize it, use the web_search tool ONCE to look it up
  (e.g., query: "{name} genre BPM tempo").
- Read the search results to identify the actual genre, subgenre, tempo, and mood.

Otherwise (just generic mood/genre words), skip search — reply from training knowledge.

Output ONLY the descriptor string. Format guideline:
"{subgenre}, ~{bpm} BPM, {mood/energy}, {1-2 instrumental hints}, {artist style if applicable}"

No preamble, no quotes, no explanation.`;

  // Hard timeout so a slow/unreachable web_search backend can't pin the
  // generate-music route at the function ceiling. Caller's fallback to
  // buildSunoStyle() takes over if we abort.
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), REFINE_TIMEOUT_MS);

  let usedWebSearch = false;
  let descriptor: string;
  try {
    const client = new Anthropic({ apiKey: env.anthropicApiKey });
    const result = await client.messages.create(
      {
        model: env.anthropicModel,
        max_tokens: REFINE_MAX_TOKENS,
        temperature: 0.4,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: REFINE_WEB_SEARCH_MAX_USES,
          },
        ],
        messages: [{ role: "user", content: prompt }],
      },
      { signal: abort.signal },
    );

    // The response contains interleaved blocks when web_search runs:
    // server_tool_use → web_search_tool_result → … → text. The descriptor
    // is the FINAL text block. Walk in reverse so we land on the model's
    // post-search synthesis rather than any pre-search planning text.
    let finalText: string | null = null;
    for (let i = result.content.length - 1; i >= 0; i -= 1) {
      const block = result.content[i];
      if (block.type === "text" && block.text.trim()) {
        finalText = block.text;
        break;
      }
    }
    if (!finalText) {
      throw new Error("Claude refine returned no text block");
    }
    usedWebSearch = result.content.some(
      (block) => block.type === "server_tool_use" && block.name === "web_search",
    );
    descriptor = tidyDescriptor(finalText);
    if (!descriptor) {
      throw new Error("Claude refine returned empty descriptor");
    }
  } finally {
    clearTimeout(timeout);
  }

  console.log(
    `[refine-style] refined web_search=${usedWebSearch} key=${cacheKey.slice(0, 24)}…`,
  );

  // Write-through cache. Failure here is non-fatal — we already have the
  // descriptor; future requests will just re-run the live call.
  try {
    await kv.set(cacheKey, descriptor, { ex: REFINE_CACHE_TTL_SECONDS });
  } catch (err) {
    console.warn("[refine-style] cache write failed:", err);
  }

  return descriptor;
}

export async function generateLyrics(input: LyricsInput): Promise<Lyrics> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const userMessage = buildUserMessage(input);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await callClaude(client, userMessage, attempt === 1 ? STRICT_RETRY_REMINDER : undefined);
    try {
      const parsed = JSON.parse(extractJson(text)) as ClaudeRaw;
      const { title, sections, style } = validateAndNormalize(parsed);
      return {
        title,
        sections,
        raw: buildRawLyrics(sections),
        style,
        language: input.language,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Failed to parse Claude lyrics response after retry: ${(lastError as Error)?.message ?? "unknown"}`);
}
