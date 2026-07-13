// Tiny client-side poster for durable generation events. Fire-and-forget and
// never throws — a failed event log must never degrade playback, sharing, or
// any UI action. Posts to /api/events, which validates + persists server-side.
//
// This is a plain module (no server imports) so it bundles cleanly into client
// components. It reuses the same anonymous id the cookie banner created.

import { getAttribution } from "./attribution";

const ANON_ID_KEY = "smb_anon_id";

export type ClientEventType = "playback_started" | "share_click" | "share_page_view";

export function getAnonId(): string | undefined {
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id = `anon_${crypto.randomUUID()}`;
    window.localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return undefined;
  }
}

export type ClientEventContext = {
  share_id?: string | null;
  venue_slug?: string | null;
  recipient_name?: string | null;
  language?: string | null;
  genre?: string | null;
  email?: string | null;
  metadata?: Record<string, string | number | boolean>;
};

export function logClientEvent(eventType: ClientEventType, ctx: ClientEventContext = {}): void {
  try {
    const attr = getAttribution();
    const payload: Record<string, unknown> = {
      event_type: eventType,
      anonymous_id: getAnonId(),
      source: attr.source,
      referrer: attr.referrer || undefined,
    };
    for (const [k, v] of Object.entries(ctx)) {
      if (v !== undefined && v !== null) payload[k] = v;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never throw into the UI.
  }
}
