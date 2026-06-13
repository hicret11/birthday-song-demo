// Next.js 16 "Proxy" (formerly Middleware). Optimistic gate for /admin/* — an
// edge-safe PRESENCE check only (no crypto). Authoritative HMAC verification of
// the session happens server-side in lib/admin-auth.ts (requireAdmin / isAuthed),
// per Next's guidance that Proxy is for optimistic checks, not full auth.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-cookie";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page (and its server-action POSTs) must be reachable unauthenticated.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  if (!request.cookies.get(ADMIN_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
