import { randomBytes } from "node:crypto";
import { kv } from "@vercel/kv";
import type { SharedSong } from "./api-types";
import { removePendingUnlock } from "./pending-unlocks";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ID_LENGTH = 8;
const SHARE_TTL_SECONDS = 90 * 24 * 60 * 60;

export function generateShareId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let id = "";
  for (let i = 0; i < ID_LENGTH; i += 1) {
    id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return id;
}

function shareKey(id: string): string {
  return `share:${id}`;
}

export async function saveSharedSong(song: SharedSong): Promise<void> {
  await kv.set(shareKey(song.id), song, { ex: SHARE_TTL_SECONDS });
}

export async function loadSharedSong(id: string): Promise<SharedSong | null> {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(id)) return null;
  const value = await kv.get<SharedSong>(shareKey(id));
  return value ?? null;
}

// ── Crowd-magic director token ────────────────────────────────────────────
// Only the giver who minted a crowd gift may close it. We record their stable
// (per-browser) director token under a SEPARATE KV key — NOT on the SharedSong
// — because toPublicSong spreads the song to clients, so a token stored there
// would leak to anyone who opened /share/[id]. Kept out of the served payload,
// it can only be checked server-side against the caller's cookie.
function directorKey(id: string): string {
  return `crowd:director:${id}`;
}

export async function saveCrowdDirectorToken(id: string, token: string): Promise<void> {
  await kv.set(directorKey(id), token, { ex: SHARE_TTL_SECONDS });
}

export async function loadCrowdDirectorToken(id: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(id)) return null;
  return (await kv.get<string>(directorKey(id))) ?? null;
}

/**
 * Flip a song to unlocked after a successful one-time payment. Called from the
 * Stripe webhook (checkout.session.completed). Idempotent — repeat webhook
 * deliveries are harmless. Resetting the TTL on unlock is intentional: a song
 * someone paid for should not silently expire out from under them.
 * Returns false if the share id is unknown (e.g. KV expired before payment).
 */
export async function markSharedSongUnlocked(
  id: string,
  plan?: "full" | "deluxe",
): Promise<boolean> {
  const song = await loadSharedSong(id);
  if (!song) return false;
  // Persist the purchased plan even on idempotent replays (e.g. a Deluxe
  // upgrade after a prior Standard unlock, or a duplicate webhook delivery that
  // now carries the plan). Default to "full" when unspecified.
  const resolvedPlan: "full" | "deluxe" = plan ?? song.plan ?? "full";
  if (!song.unlocked || song.plan !== resolvedPlan) {
    song.unlocked = true;
    if (!song.unlockedAt) song.unlockedAt = Date.now();
    song.plan = resolvedPlan;
    await kv.set(shareKey(song.id), song, { ex: SHARE_TTL_SECONDS });
  }
  // They paid — stop any pending abandoned-preview reminders. Best-effort and
  // idempotent: removePendingUnlock swallows its own errors and is harmless if
  // the share was never enrolled (no email) or already removed.
  await removePendingUnlock(id);
  return true;
}

/**
 * Persist additive artifacts onto an existing song: photo URLs, a rendered
 * slideshow video, karaoke captions, or the premium Remotion video URL/status.
 */
export async function updateSharedSong(
  id: string,
  patch: Partial<
    Pick<
      SharedSong,
      | "photoUrls"
      | "slideshowVideoUrl"
      | "captions"
      | "premiumVideoUrl"
      | "videoStatus"
      | "previewAudioUrl"
    >
  >,
): Promise<boolean> {
  const song = await loadSharedSong(id);
  if (!song) return false;
  Object.assign(song, patch);
  await kv.set(shareKey(song.id), song, { ex: SHARE_TTL_SECONDS });
  return true;
}
