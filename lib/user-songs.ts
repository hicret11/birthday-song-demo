// Per-email index of created songs, so a logged-in user can see "My Songs"
// across devices and return to anything they unlocked. Keyed by lowercased
// email; stores the most-recent share ids. Best-effort — failures here never
// block song creation (the index is a convenience, not the source of truth).

import { kv } from "@vercel/kv";

const MAX_PER_USER = 100;
const TTL_SECONDS = 90 * 24 * 60 * 60; // match the share TTL

function key(email: string): string {
  return `user:songs:${email.trim().toLowerCase()}`;
}

/** Prepend a share id to the user's song list (deduped, capped, TTL-refreshed). */
export async function addSongToUser(email: string, shareId: string): Promise<void> {
  const k = key(email);
  const existing = (await kv.get<string[]>(k)) ?? [];
  const next = [shareId, ...existing.filter((id) => id !== shareId)].slice(0, MAX_PER_USER);
  await kv.set(k, next, { ex: TTL_SECONDS });
}

/** Most-recent-first share ids for a user's email. */
export async function listUserSongIds(email: string): Promise<string[]> {
  return (await kv.get<string[]>(key(email))) ?? [];
}
