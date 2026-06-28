import { randomBytes } from "node:crypto";
import { kv } from "@vercel/kv";
import type { SharedSong } from "./api-types";

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

/**
 * Flip a song to unlocked after a successful one-time payment. Called from the
 * Stripe webhook (checkout.session.completed). Idempotent — repeat webhook
 * deliveries are harmless. Resetting the TTL on unlock is intentional: a song
 * someone paid for should not silently expire out from under them.
 * Returns false if the share id is unknown (e.g. KV expired before payment).
 */
export async function markSharedSongUnlocked(id: string): Promise<boolean> {
  const song = await loadSharedSong(id);
  if (!song) return false;
  if (!song.unlocked) {
    song.unlocked = true;
    song.unlockedAt = Date.now();
    await kv.set(shareKey(song.id), song, { ex: SHARE_TTL_SECONDS });
  }
  return true;
}

/** Persist photo URLs and/or a rendered slideshow video onto an existing song. */
export async function updateSharedSong(
  id: string,
  patch: Partial<Pick<SharedSong, "photoUrls" | "slideshowVideoUrl">>,
): Promise<boolean> {
  const song = await loadSharedSong(id);
  if (!song) return false;
  Object.assign(song, patch);
  await kv.set(shareKey(song.id), song, { ex: SHARE_TTL_SECONDS });
  return true;
}
