// Durable generation/playback/download/share event logging.
//
// Lightweight, best-effort, append-only. Every helper here MUST swallow its own
// errors — a failed event insert can never block generation, playback, sharing,
// or downloads. This is first-party operational/audit data, not third-party
// analytics, so it does not depend on the Phase 1 analytics cookie consent.

import { getGeoContext } from "./geo";
import { getSupabaseAdmin } from "./supabase-admin";

export const GENERATION_EVENT_TYPES = [
  "generation_started", // lyrics requested
  "music_submitted",
  "song_ready",
  "playback_started",
  "download_requested",
  "share_created",
  "share_click",
  "share_page_view",
] as const;

export type GenerationEventType = (typeof GENERATION_EVENT_TYPES)[number];

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(GENERATION_EVENT_TYPES);

export function isGenerationEventType(value: unknown): value is GenerationEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}

const MAX_TEXT_LEN = 120;
const MAX_EMAIL_LEN = 254;
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_VALUE_LEN = 200;

export type GenerationEventContext = {
  email?: string | null;
  anonymousId?: string | null;
  shareId?: string | null;
  venueSlug?: string | null;
  recipientName?: string | null;
  language?: string | null;
  genre?: string | null;
  country?: string | null;
  region?: string | null;
  /** First-touch traffic source (utm/referrer/`?src=`) and raw referrer host. */
  source?: string | null;
  referrer?: string | null;
  policyVersion?: string | null;
  captureVersion?: string | null;
  metadata?: Record<string, unknown> | null;
};

function clean(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  out = out.trim().slice(0, maxLen);
  return out || null;
}

// Shallow-sanitize metadata: only primitive values, bounded key count and value
// length, no nested objects. Keeps the jsonb column small and non-sensitive.
function sanitizeMetadata(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (count >= MAX_METADATA_KEYS) break;
    const k = clean(key, 40);
    if (!k) continue;
    if (typeof value === "string") {
      const v = clean(value, MAX_METADATA_VALUE_LEN);
      if (v !== null) {
        out[k] = v;
        count += 1;
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[k] = value;
      count += 1;
    } else if (typeof value === "boolean") {
      out[k] = value;
      count += 1;
    }
    // Objects/arrays/null are dropped — metadata stays flat and bounded.
  }
  return out;
}

/**
 * Insert one generation event, best-effort. Never throws.
 *
 * Geo (country/region) is derived server-side from the incoming request's edge
 * headers when a `request` is provided; an explicit country/region in `ctx`
 * wins if set. Absent in local dev (stored as null).
 *
 * Callers should not await this in a way that delays the user response — use
 * `after(logGenerationEvent(...))` (next/server) in route handlers so the
 * function stays alive until the insert completes without blocking the reply.
 */
export async function logGenerationEvent(
  eventType: GenerationEventType,
  request: Request | null,
  ctx: GenerationEventContext = {},
): Promise<boolean> {
  try {
    const geo = request ? getGeoContext(request) : { country: null, region: null, city: null };

    const row = {
      event_type: eventType,
      email: clean(ctx.email, MAX_EMAIL_LEN)?.toLowerCase() ?? null,
      anonymous_id: clean(ctx.anonymousId, MAX_TEXT_LEN),
      share_id: clean(ctx.shareId, MAX_TEXT_LEN),
      venue_slug: clean(ctx.venueSlug, MAX_TEXT_LEN),
      recipient_name: clean(ctx.recipientName, MAX_TEXT_LEN),
      language: clean(ctx.language, MAX_TEXT_LEN),
      genre: clean(ctx.genre, MAX_TEXT_LEN),
      country: clean(ctx.country, 8) ?? geo.country,
      region: clean(ctx.region, 16) ?? geo.region,
      source: clean(ctx.source, 40),
      referrer: clean(ctx.referrer, 80),
      policy_version: clean(ctx.policyVersion, 20),
      capture_version: clean(ctx.captureVersion, 20),
      metadata: sanitizeMetadata(ctx.metadata),
    };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("generation_events").insert([row]);
    if (error) {
      console.error(`[events] insert failed (${eventType}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    // Swallow everything — event logging must never affect the user flow.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[events] logging threw (${eventType}):`, message);
    return false;
  }
}
