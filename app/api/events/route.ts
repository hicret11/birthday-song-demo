// Client-originated generation events (playback, share click, share page view).
//
// Server routes log their own events directly via lib/events. This endpoint
// exists only for events the browser is the source of truth for. It is
// best-effort and non-blocking: the client fires it fire-and-forget and ignores
// the response. We still validate the event type and report insert failures
// honestly (ok:false) rather than pretend success.

import {
  isGenerationEventType,
  logGenerationEvent,
  type GenerationEventContext,
} from "@/lib/events";

export const runtime = "nodejs";

// Only these event types may originate from the client. Generation/music/share
// creation/download are logged server-side from their own routes.
const CLIENT_EVENT_TYPES: ReadonlySet<string> = new Set([
  "playback_started",
  "share_click",
  "share_page_view",
]);

type EventBody = {
  event_type?: unknown;
  email?: unknown;
  anonymous_id?: unknown;
  share_id?: unknown;
  venue_slug?: unknown;
  recipient_name?: unknown;
  language?: unknown;
  genre?: unknown;
  source?: unknown;
  referrer?: unknown;
  metadata?: unknown;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: Request): Promise<Response> {
  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return Response.json({ error: { message: "Invalid JSON." } }, { status: 400 });
  }

  const eventType = body.event_type;
  if (!isGenerationEventType(eventType) || !CLIENT_EVENT_TYPES.has(eventType)) {
    return Response.json({ error: { message: "Unknown event type." } }, { status: 400 });
  }

  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : undefined;

  const ctx: GenerationEventContext = {
    email: str(body.email),
    anonymousId: str(body.anonymous_id),
    shareId: str(body.share_id),
    venueSlug: str(body.venue_slug),
    recipientName: str(body.recipient_name),
    language: str(body.language),
    genre: str(body.genre),
    source: str(body.source),
    referrer: str(body.referrer),
    metadata,
  };

  // logGenerationEvent is best-effort and never throws; it returns whether the
  // row actually persisted. We report that honestly (ok:false on insert
  // failure) rather than claim success. The client fires this fire-and-forget
  // and ignores the response, so this never blocks a user action.
  const ok = await logGenerationEvent(eventType, request, ctx);
  return Response.json({ ok });
}
