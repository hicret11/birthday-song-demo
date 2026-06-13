// Admin auth for the internal dashboard (Phase A). Stateless HMAC-signed cookie,
// same HMAC approach as the venue portal tokens but self-contained (no DB).
// Server-only (Node runtime): never import from a client component.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { kv } from "@vercel/kv";
import { ADMIN_COOKIE } from "./admin-cookie";
import { rateLimitFixedWindow } from "./rate-limit";

export const SESSION_TTL_SECONDS = 8 * 60 * 60; // short-lived admin session

// ── Login brute-force protection (counts FAILED attempts only) ──────────────
export const LOGIN_MAX_PER_IP = 5; // failed attempts per IP per window
export const LOGIN_MAX_GLOBAL = 20; // failed attempts across all IPs per window
export const LOGIN_WINDOW_SECONDS = 15 * 60;

const LOGIN_ALL_KEY = "rate:admin-login:all";
function loginIpKey(ip: string): string {
  return `rate:admin-login:ip:${ip}`;
}

/** Pure threshold predicate (unit-testable, no IO). */
export function isLoginBlocked(ipCount: number, allCount: number): boolean {
  return ipCount >= LOGIN_MAX_PER_IP || allCount >= LOGIN_MAX_GLOBAL;
}

/** Read current failure counts and decide if blocked. Fails OPEN if KV is down. */
export async function checkLoginRate(ip: string): Promise<{ blocked: boolean }> {
  try {
    const [ipRaw, allRaw] = await Promise.all([kv.get(loginIpKey(ip)), kv.get(LOGIN_ALL_KEY)]);
    return { blocked: isLoginBlocked(Number(ipRaw) || 0, Number(allRaw) || 0) };
  } catch {
    console.warn("[admin-login] rate-limit KV unavailable (check) — failing open");
    return { blocked: false };
  }
}

/** Increment failure counters (per-IP + global) within the window. Fails OPEN. */
export async function recordLoginFailure(ip: string): Promise<void> {
  try {
    await rateLimitFixedWindow(loginIpKey(ip), LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
    await rateLimitFixedWindow(LOGIN_ALL_KEY, LOGIN_MAX_GLOBAL, LOGIN_WINDOW_SECONDS);
  } catch {
    console.warn("[admin-login] rate-limit KV unavailable (record) — failing open");
  }
}

/** Clear the per-IP failure counter on a successful login. Best-effort. */
export async function clearLoginFailures(ip: string): Promise<void> {
  try {
    await kv.del(loginIpKey(ip));
  } catch {
    /* best-effort */
  }
}

export type AdminConfig = { password: string; secret: string };

/** Reads admin env. Throws a clear error if not configured (fail-safe). */
export function getAdminConfig(): AdminConfig {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret) {
    throw new Error(
      "Admin auth not configured — set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in the environment.",
    );
  }
  return { password, secret };
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** Build a signed session token: base64url(payload).hmac, with an expiry. */
export function signSession(secret: string, ttlSeconds: number = SESSION_TTL_SECONDS): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Verify token signature (constant-time) and expiry. */
export function verifySession(token: string, secret: string): boolean {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

/** Constant-time string compare (length-safe). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True when the current request carries a valid admin session cookie. */
export async function isAuthed(): Promise<boolean> {
  let secret: string;
  try {
    secret = getAdminConfig().secret;
  } catch {
    return false; // misconfigured server => nobody is authed (fail-safe)
  }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && verifySession(token, secret);
}

/** Redirect to the login page unless the request is authenticated. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAuthed())) redirect("/admin/login");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/admin",
    maxAge: SESSION_TTL_SECONDS,
  };
}
