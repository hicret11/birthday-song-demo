// One-shot magic-link tokens that authorize a venue owner to redeem a
// Stripe Customer Portal session. Stored in Vercel KV with a short TTL.
// The token itself is a 32-byte random hex string — opaque to the client.

import { kv } from "@vercel/kv";
import { randomBytes } from "node:crypto";

const PREFIX = "portal-token";

export type PortalTokenPayload = {
  stripe_customer_id: string;
  slug: string;
};

/**
 * Generate a fresh token and store the payload under it with the requested
 * TTL. Returns the token (caller embeds it in the magic link URL).
 *
 * `ttlSeconds` is meaningful per use-case:
 *   - venue-initiated "manage subscription" flow → 30 minutes
 *   - dunning email for failed payment → 24 hours (venue may not check
 *     email immediately, and we'd rather they update the card late
 *     than not at all)
 */
export async function mintPortalToken(
  payload: PortalTokenPayload,
  ttlSeconds: number,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await kv.set(`${PREFIX}:${token}`, payload, { ex: ttlSeconds });
  return token;
}

/**
 * Read and delete a portal token. Returns the stored payload, or null if
 * the token was never issued, has expired, or has already been redeemed.
 */
export async function consumePortalToken(
  token: string,
): Promise<PortalTokenPayload | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = `${PREFIX}:${token}`;
  try {
    const payload = await kv.get<PortalTokenPayload>(key);
    if (!payload) return null;
    await kv.del(key);
    return payload;
  } catch {
    return null;
  }
}
