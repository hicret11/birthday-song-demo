import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/login-tokens";
import { setUserSession } from "@/lib/user-session";

export const runtime = "nodejs";

/** Redeem a magic-link token: set the session cookie and land on My Songs. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const email = await consumeLoginToken(token);
  if (!email) {
    return NextResponse.redirect(`${url.origin}/login?error=expired`, 303);
  }

  const ok = await setUserSession(email);
  if (!ok) {
    // USER_SESSION_SECRET not configured — can't establish a session.
    return NextResponse.redirect(`${url.origin}/login?error=config`, 303);
  }
  return NextResponse.redirect(`${url.origin}/my-songs`, 303);
}
