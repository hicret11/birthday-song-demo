// One-shot magic-link tokens for passwordless consumer login. Same opaque
// KV-token design as lib/portal-tokens.ts, but the payload is just the email
// being verified. The token is a 32-byte random hex string, single-use.

import { kv } from "@vercel/kv";
import { randomBytes } from "node:crypto";

const PREFIX = "login-token";

/** Mint a single-use login token for `email`, stored with the given TTL. */
export async function mintLoginToken(email: string, ttlSeconds: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await kv.set(`${PREFIX}:${token}`, { email }, { ex: ttlSeconds });
  return token;
}

/** Read + delete a login token, returning the verified email or null. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = `${PREFIX}:${token}`;
  try {
    const payload = await kv.get<{ email: string }>(key);
    if (!payload?.email) return null;
    await kv.del(key);
    return payload.email;
  } catch {
    return null;
  }
}
