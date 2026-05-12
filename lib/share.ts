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
