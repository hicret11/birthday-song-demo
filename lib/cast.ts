// Cast bookings — server-side helpers (Postgres via the service role).
//
// A booking records a request for a character experience (currently the AI
// phone call) + its fulfilment status. The gift/song itself lives in KV; a
// booking may reference a gift id or stand alone.

import { getSupabaseAdmin } from "./supabase-admin";

export type CastKind = "ai_call" | "live_musician" | "character_visit";
export type CastStatus =
  | "pending"
  | "scheduled"
  | "calling"
  | "completed"
  | "failed"
  | "canceled";

export type CastBooking = {
  id: string;
  giftId: string | null;
  kind: CastKind;
  characterId: string;
  recipientName: string;
  recipientPhone: string | null;
  language: string;
  personalNote: string | null;
  scheduledAt: string | null;
  consentConfirmed: boolean;
  status: CastStatus;
  stripePaymentId: string | null;
  bookerToken: string | null;
  resultNote: string | null;
  createdAt: string;
};

const TABLE = "cast_bookings";

type Row = {
  id: string;
  gift_id: string | null;
  kind: CastKind;
  character_id: string;
  recipient_name: string;
  recipient_phone: string | null;
  language: string;
  personal_note: string | null;
  scheduled_at: string | null;
  consent_confirmed: boolean;
  status: CastStatus;
  stripe_payment_id: string | null;
  booker_token: string | null;
  result_note: string | null;
  created_at: string;
};

function toBooking(r: Row): CastBooking {
  return {
    id: r.id,
    giftId: r.gift_id,
    kind: r.kind,
    characterId: r.character_id,
    recipientName: r.recipient_name,
    recipientPhone: r.recipient_phone,
    language: r.language,
    personalNote: r.personal_note,
    scheduledAt: r.scheduled_at,
    consentConfirmed: r.consent_confirmed,
    status: r.status,
    stripePaymentId: r.stripe_payment_id,
    bookerToken: r.booker_token,
    resultNote: r.result_note,
    createdAt: r.created_at,
  };
}

const COLS =
  "id, gift_id, kind, character_id, recipient_name, recipient_phone, language, personal_note, scheduled_at, consent_confirmed, status, stripe_payment_id, booker_token, result_note, created_at";

export async function createBooking(input: {
  giftId?: string | null;
  kind?: CastKind;
  characterId: string;
  recipientName: string;
  recipientPhone?: string | null;
  language?: string;
  personalNote?: string | null;
  scheduledAt?: string | null;
  consentConfirmed: boolean;
  bookerToken?: string | null;
}): Promise<CastBooking | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      gift_id: input.giftId ?? null,
      kind: input.kind ?? "ai_call",
      character_id: input.characterId,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone ?? null,
      language: input.language ?? "English",
      personal_note: input.personalNote ?? null,
      scheduled_at: input.scheduledAt ?? null,
      consent_confirmed: input.consentConfirmed,
      booker_token: input.bookerToken ?? null,
      status: "pending",
    })
    .select(COLS)
    .single();
  if (error || !data) {
    console.error("[cast] createBooking failed:", error?.message);
    return null;
  }
  return toBooking(data as Row);
}

export async function getBooking(id: string): Promise<CastBooking | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(TABLE).select(COLS).eq("id", id).single();
  if (error || !data) return null;
  return toBooking(data as Row);
}

export async function updateBookingStatus(
  id: string,
  status: CastStatus,
  resultNote?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({
      status,
      result_note: resultNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.error("[cast] updateBookingStatus failed:", error.message);
}

/**
 * Mark a booking paid: store the Stripe payment id and move it to "scheduled"
 * so the scheduler will place the call. Idempotent — the Stripe webhook may
 * deliver `checkout.session.completed` more than once, and we only advance a
 * booking that is still "pending" (a booking already scheduled/calling/completed
 * is left untouched so a retry can't rewind or double-book it). Returns the
 * updated booking, or null when nothing was updated. Best-effort: never throws.
 */
export async function markBookingPaid(
  id: string,
  stripePaymentId: string,
): Promise<CastBooking | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: "scheduled",
      stripe_payment_id: stripePaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(COLS)
    .maybeSingle();
  if (error) {
    console.error("[cast] markBookingPaid failed:", error.message);
    return null;
  }
  return data ? toBooking(data as Row) : null;
}

/**
 * Bookings that are due to be fulfilled: status "scheduled" and either no
 * scheduled_at (send now) or scheduled_at already in the past. Ordered oldest
 * first so the scheduler drains a backlog fairly. `nowIso`/`limit` are passed in
 * so the caller controls the clock (Date is unavailable in some contexts).
 */
export async function listDueBookings(nowIso: string, limit = 25): Promise<CastBooking[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq("status", "scheduled")
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data) {
    console.error("[cast] listDueBookings failed:", error?.message);
    return [];
  }
  return (data as Row[]).map(toBooking);
}

/**
 * Atomically claim a scheduled booking for calling, so two concurrent scheduler
 * runs can't place the same call twice. Flips "scheduled" → "calling" only if it
 * is still "scheduled"; returns true if THIS caller won the claim.
 */
export async function claimBookingForCalling(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: "calling", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[cast] claimBookingForCalling failed:", error.message);
    return false;
  }
  return !!data;
}
