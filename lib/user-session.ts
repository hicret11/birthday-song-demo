// Stateless, HMAC-signed session cookie for the optional consumer login.
// Mirrors the spirit of lib/admin-auth (signed cookie) but for end users, and
// stores only the verified email. No DB session table — the signature is the
// proof. Login is OPTIONAL: nothing in the create/buy flow depends on it; this
// only lets a returning user open the songs tied to their email.

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "smb_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

function secret(): string | null {
  return process.env.USER_SESSION_SECRET ?? null;
}

function sign(email: string, s: string): string {
  return createHmac("sha256", s).update(email).digest("hex");
}

/** Set the signed session cookie. Call only from a route handler / action. */
export async function setUserSession(email: string): Promise<boolean> {
  const s = secret();
  if (!s) return false;
  const value = `${encodeURIComponent(email)}.${sign(email, s)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

/** Return the verified email from the session cookie, or null. Read-safe in
 *  server components. */
export async function getUserEmail(): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return null;
  const email = decodeURIComponent(raw.slice(0, idx));
  const sig = raw.slice(idx + 1);
  const expected = sign(email, s);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return email;
  } catch {
    // malformed signature
  }
  return null;
}

/** Clear the session cookie. Call only from a route handler / action. */
export async function clearUserSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 });
}
