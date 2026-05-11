import Anthropic from "@anthropic-ai/sdk";
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
};

const SYSTEM_PROMPT = `You are a professional birthday song lyricist who writes warm, personal, and singable lyrics in any language. You write lyrics natively in the target language — never translate from English. You respect cultural birthday traditions:
- Turkish: echoes of "İyi ki doğdun" / "Mutlu yıllar sana" cadences are welcome.
- Spanish: "Las Mañanitas" warmth, or "Cumpleaños Feliz" feel.
- French: "Joyeux Anniversaire" structure.
- Arabic: "كل عام وأنت بخير" / "سنة حلوة يا جميل" sensibility; use Modern Standard Arabic unless the genre calls for dialect.
- Hindi: "Janam Din Mubarak ho" / "Bar bar din ye aaye" feel; Devanagari script.
- English: modern singable; do NOT reuse the "Happy Birthday to You" copyrighted melody/lyrics.

You match the requested genre's lyrical conventions (Hip-Hop = rhyme density and flow, Jazz = imagery and intimacy, Pop = hooks and repetition, Rock = energy and anthems, R&B = emotion and groove, Electronic = chant-friendly and rhythmic).

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

  return `Write a personalized birthday song with these inputs:

- Name: ${input.name}
- Language: ${input.language} (write all lyrics in this language)
- Genre: ${genreClean}${advancedBlock}

Output a JSON object exactly matching this schema:

{
  "title": "string — short, in the target language",
  "sections": [
    { "tag": "Verse" | "Chorus" | "Bridge" | "Outro", "lines": ["string", "..."] }
  ],
  "style": "string — 1-2 sentence English description of genre + mood for the music model (e.g. 'upbeat pop with warm acoustic guitar and bright vocals')"
}

Constraints:
- Total length: ≈ 1 verse + 1 chorus + 1 verse + 1 chorus + 1 bridge + 1 outro (or shorter for Hip-Hop's 16-bar conventions).
- Use ${input.name} in at least the chorus.
- Reference advanced fields naturally if provided; do not force-fit irrelevant ones.
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

function buildRawLyrics(sections: LyricSection[]): string {
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

async function callClaude(client: Anthropic, userMessage: string, extraSystem?: string): Promise<string> {
  const result = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 1500,
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
