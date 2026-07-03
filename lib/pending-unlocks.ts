import { kv } from "@vercel/kv";

/**
 * Abandoned-preview recovery store.
 *
 * When someone creates a song + hears the 15-second preview but does NOT pay
 * to unlock, we track the share here so an hourly cron can send a short
 * reminder sequence ("your song is waiting — unlock it"). Everything in this
 * module is best-effort: KV failures are logged and swallowed, never thrown
 * into the request path. The main generate → preview → pay flow must keep
 * working even if recovery bookkeeping is unavailable.
 *
 * Layout:
 *  - `pending-unlocks` (sorted set): score = createdAt ms, member = shareId.
 *    Lets the cron scan candidates by age via zrange byScore.
 *  - `pending-unlock:<id>` (string/json, 7-day TTL): the per-share recovery
 *    record with everything the cron needs to send an email without touching
 *    the SharedSong row (which intentionally does NOT store the recipient
 *    email). `stage` = how many reminder emails have been sent (starts at 0).
 */

const PENDING_SET_KEY = "pending-unlocks";
const RECORD_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800

function recordKey(id: string): string {
  return `pending-unlock:${id}`;
}

export type PendingUnlockRecord = {
  email: string;
  recipientName: string;
  shareUrl: string;
  createdAt: number;
  /** Number of reminder emails already sent (0 → none yet, max 3). */
  stage: number;
};

export type AddPendingUnlockInput = {
  id: string;
  email: string;
  recipientName: string;
  shareUrl: string;
};

/**
 * Register a freshly-created, still-locked share for the recovery sequence.
 * zadd into the age-ordered set + write the per-share record with a 7-day TTL.
 * Best-effort: any failure is logged and swallowed.
 */
export async function addPendingUnlock(input: AddPendingUnlockInput): Promise<void> {
  try {
    const createdAt = Date.now();
    const record: PendingUnlockRecord = {
      email: input.email,
      recipientName: input.recipientName,
      shareUrl: input.shareUrl,
      createdAt,
      stage: 0,
    };
    await kv.zadd(PENDING_SET_KEY, { score: createdAt, member: input.id });
    await kv.set(recordKey(input.id), record, { ex: RECORD_TTL_SECONDS });
  } catch (err) {
    console.error(`[pending-unlocks] addPendingUnlock failed id=${input.id}`, err);
  }
}

/**
 * Stop reminders for a share. Called when the song is unlocked (payment) or
 * when the sequence is exhausted/aged out. Removes both the set member and the
 * record. Best-effort.
 */
export async function removePendingUnlock(id: string): Promise<void> {
  try {
    await kv.zrem(PENDING_SET_KEY, id);
    await kv.del(recordKey(id));
  } catch (err) {
    console.error(`[pending-unlocks] removePendingUnlock failed id=${id}`, err);
  }
}

/**
 * Return all share ids whose createdAt score is in (0 .. maxScoreMs]. The cron
 * passes Date.now() to fetch every candidate and filters by age itself.
 * Best-effort: returns [] on failure so the cron can no-op cleanly.
 */
export async function listDuePendingUnlockIds(maxScoreMs: number): Promise<string[]> {
  try {
    const ids = await kv.zrange<string[]>(PENDING_SET_KEY, 0, maxScoreMs, {
      byScore: true,
    });
    return Array.isArray(ids) ? ids : [];
  } catch (err) {
    console.error("[pending-unlocks] listDuePendingUnlockIds failed", err);
    return [];
  }
}

/** Load the per-share recovery record, or null if missing/expired/error. */
export async function getPendingUnlock(id: string): Promise<PendingUnlockRecord | null> {
  try {
    const record = await kv.get<PendingUnlockRecord>(recordKey(id));
    return record ?? null;
  } catch (err) {
    console.error(`[pending-unlocks] getPendingUnlock failed id=${id}`, err);
    return null;
  }
}

/**
 * Persist a new stage count after a reminder is sent. Preserves the remaining
 * TTL approximation by re-writing the record with a fresh 7-day TTL (a song in
 * active recovery should not expire out from under the sequence). Best-effort.
 */
export async function setPendingStage(id: string, stage: number): Promise<void> {
  try {
    const record = await kv.get<PendingUnlockRecord>(recordKey(id));
    if (!record) return;
    record.stage = stage;
    await kv.set(recordKey(id), record, { ex: RECORD_TTL_SECONDS });
  } catch (err) {
    console.error(`[pending-unlocks] setPendingStage failed id=${id} stage=${stage}`, err);
  }
}
