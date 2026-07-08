// Best-effort content moderation for user free-text that becomes a PUBLIC
// artifact: the recipient name renders on the share page and the OG card, and
// name/notes steer the generated lyrics. Uses OpenAI's moderation endpoint
// (free, reuses OPENAI_API_KEY).
//
// FAILS OPEN on any error or missing key — a real birthday must never be
// blocked by an API blip — but a positive flag on a serious category rejects
// the share before we spend money rendering/persisting it.

import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

// Categories we refuse to publish. Deliberately narrower than "anything
// flagged" so mildly edgy-but-benign birthday humor isn't over-blocked, while
// the clearly-unacceptable is always caught.
const BLOCK_CATEGORIES = new Set<string>([
  "sexual",
  "sexual/minors",
  "hate",
  "hate/threatening",
  "harassment/threatening",
  "self-harm/intent",
  "self-harm/instructions",
  "violence/graphic",
  "illicit/violent",
]);

const MODERATION_MODEL = process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";

export type ModerationResult = { allowed: boolean; categories?: string[] };

/**
 * Screen the combined user free-text. Returns { allowed:false, categories }
 * when a blocked category trips; { allowed:true } otherwise (including on any
 * failure — fail-open by design).
 */
export async function moderateShareInput(
  parts: (string | undefined | null)[],
): Promise<ModerationResult> {
  const text = parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join("\n")
    .slice(0, 4000);
  if (!text) return { allowed: true };

  const openai = getClient();
  if (!openai) return { allowed: true }; // no key configured — fail open

  try {
    const res = await openai.moderations.create({ model: MODERATION_MODEL, input: text });
    const result = res.results?.[0];
    if (!result || !result.flagged) return { allowed: true };

    const catsObj = (result.categories ?? {}) as unknown as Record<string, boolean>;
    const flaggedCats = Object.entries(catsObj)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    const blocked = flaggedCats.filter((c) => BLOCK_CATEGORIES.has(c));
    if (blocked.length > 0) return { allowed: false, categories: blocked };
    return { allowed: true };
  } catch (err) {
    console.error(
      "[moderation] check failed (fail-open):",
      err instanceof Error ? err.message : err,
    );
    return { allowed: true };
  }
}
