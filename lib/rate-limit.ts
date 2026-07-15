import { kv } from "@vercel/kv";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  resetInSeconds: number | null;
};

/**
 * Optional context passed to rateLimitFixedWindow to enable the team bypass.
 * Provide the inbound `Request` so we can read the X-Admin-Bypass header,
 * and (optionally) a pre-computed `ip` so we don't re-derive it.
 */
export type RateLimitBypassContext = {
  request?: Request;
  ip?: string;
  /** True when the caller is a verified comp admin — unlimited generation. */
  admin?: boolean;
};

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

/**
 * Returns true when the request matches a permanent rate-limit exemption.
 *
 * Two independent mechanisms, both checked:
 *   1. TEAM_BYPASS_IPS — comma-separated list of trusted IPs. To add your
 *      IP, curl ifconfig.me from the network you'll be testing on, append
 *      to TEAM_BYPASS_IPS in Vercel env (all three environments). Use this
 *      for normal browser testing from a fixed location.
 *   2. ADMIN_BYPASS_TOKEN + X-Admin-Bypass header — request-time secret.
 *      Use this for CLI / scripted tests from any network (mobile, coffee
 *      shop, etc.) where the IP isn't stable.
 *
 * Header check fires only when ADMIN_BYPASS_TOKEN is set on the server, so
 * an empty env var can't be matched by a missing header.
 */
export function isRateLimitBypassed(ctx?: RateLimitBypassContext): boolean {
  if (!ctx) return false;

  // Comp admin (verified magic-link session) — unlimited generation.
  if (ctx.admin) return true;

  // Header bypass — works from any network.
  const adminToken = process.env.ADMIN_BYPASS_TOKEN;
  if (ctx.request && adminToken && adminToken.length > 0) {
    const provided = ctx.request.headers.get("x-admin-bypass");
    if (provided && provided === adminToken) {
      return true;
    }
  }

  // IP bypass — works for normal browser sessions from trusted networks.
  const raw = process.env.TEAM_BYPASS_IPS;
  if (raw && raw.trim()) {
    const ip = ctx.ip ?? (ctx.request ? getClientIp(ctx.request) : null);
    if (ip && ip !== "unknown") {
      const trusted = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (trusted.includes(ip)) return true;
    }
  }

  return false;
}

export async function rateLimitFixedWindow(
  key: string,
  limit: number,
  windowSeconds: number,
  bypass?: RateLimitBypassContext,
): Promise<RateLimitResult> {
  // Team bypass — short-circuits before any KV read so trusted callers
  // never increment the counter. Failsafe behavior (KV-down fall-open) is
  // unchanged for everyone else.
  if (isRateLimitBypassed(bypass)) {
    return {
      allowed: true,
      count: 0,
      remaining: limit,
      resetInSeconds: null,
    };
  }

  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, windowSeconds);
  }
  let resetInSeconds: number | null = null;
  try {
    const ttl = await kv.ttl(key);
    resetInSeconds = typeof ttl === "number" && ttl > 0 ? ttl : null;
  } catch {
    resetInSeconds = null;
  }
  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    resetInSeconds,
  };
}
