import { mintLoginToken } from "@/lib/login-tokens";
import { sendLoginLinkEmail } from "@/lib/resend";
import { getClientIp, rateLimitFixedWindow } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const TOKEN_TTL_SECONDS = 30 * 60;

/**
 * Request a passwordless sign-in link. We ALWAYS respond { ok: true } regardless
 * of whether the email has any songs — never leak account existence. The link
 * is emailed; clicking it (the verify route) establishes the session.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return Response.json({ error: { message: "Invalid request." } }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LEN) {
    return Response.json({ error: { message: "Please enter a valid email." } }, { status: 400 });
  }

  // Light per-IP throttle so the endpoint can't be used to spam inboxes. Fail
  // open on KV trouble, and on limit just pretend success (don't leak state).
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitFixedWindow(`rate:login:${ip}`, 8, 60 * 60, { request, ip });
    if (!rl.allowed) return Response.json({ ok: true });
  } catch {
    // fail open
  }

  const token = await mintLoginToken(email, TOKEN_TTL_SECONDS);
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const loginUrl = `${origin}/api/auth/verify?token=${token}`;
  await sendLoginLinkEmail({ to: email, loginUrl });

  return Response.json({ ok: true });
}
