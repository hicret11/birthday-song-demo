"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/lib/admin-cookie";
import {
  checkLoginRate,
  clearLoginFailures,
  getAdminConfig,
  recordLoginFailure,
  safeEqual,
  signSession,
  sessionCookieOptions,
} from "@/lib/admin-auth";

/** Best-effort client IP from proxy headers (never surfaced to the client / logs). */
async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || h.get("x-real-ip")?.trim() || "unknown";
}

export async function loginAction(formData: FormData): Promise<void> {
  let cfg: { password: string; secret: string };
  try {
    cfg = getAdminConfig();
  } catch {
    redirect("/admin/login?error=config"); // env missing → fail safe with a clear message
  }

  const ip = await clientIp();

  // Brute-force gate: block BEFORE checking the password (don't reveal correctness).
  const { blocked } = await checkLoginRate(ip);
  if (blocked) {
    redirect("/admin/login?error=ratelimit");
  }

  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, cfg.password)) {
    await recordLoginFailure(ip); // count only failed attempts
    redirect("/admin/login?error=invalid");
  }

  await clearLoginFailures(ip); // reset on success
  const store = await cookies();
  store.set(ADMIN_COOKIE, signSession(cfg.secret), sessionCookieOptions());
  redirect("/admin/generations");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  redirect("/admin/login");
}
