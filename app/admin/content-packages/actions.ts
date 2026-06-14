"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordAction, recheckPackagePermission, type AdminAction } from "@/lib/admin-packages";
import { createPost, SOCIAL_PLATFORMS } from "@/lib/admin-social";
import { suggestedContent } from "@/lib/content-packages";

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;

async function run(shareId: string, action: AdminAction, formData: FormData): Promise<void> {
  await requireAdmin(); // server actions are directly callable — re-check auth
  if (!ID_RE.test(shareId)) redirect("/admin/content-packages");
  const note = String(formData?.get("note") ?? "").slice(0, 500) || null;
  const res = await recordAction(shareId, action, note);
  const q = res.ok
    ? `ok=${encodeURIComponent("Status updated → " + res.nextStatus)}`
    : `err=${encodeURIComponent(res.error)}`;
  redirect(`/admin/content-packages/${shareId}?${q}`);
}

export async function approveAction(shareId: string, formData: FormData): Promise<void> {
  await run(shareId, "approve", formData);
}
export async function declineAction(shareId: string, formData: FormData): Promise<void> {
  await run(shareId, "decline", formData);
}
export async function resetReviewAction(shareId: string, formData: FormData): Promise<void> {
  await run(shareId, "reset-review", formData);
}
export async function markPostedAction(shareId: string, formData: FormData): Promise<void> {
  await run(shareId, "mark-posted", formData);
}

// Re-check promo permission for a package whose permission may have been granted
// after it was packaged. Re-resolved + updated SERVER-SIDE (fail-closed). Never
// approves or posts — at most moves needs-permission → pending-review.
export async function recheckPermissionAction(shareId: string): Promise<void> {
  await requireAdmin();
  if (!ID_RE.test(shareId)) redirect("/admin/content-packages");
  const res = await recheckPackagePermission(shareId);
  if (!res.ok) {
    const msg = res.notFound ? "package not found" : res.error;
    redirect(`/admin/content-packages/${shareId}?err=${encodeURIComponent(msg)}`);
  }
  const MESSAGES: Record<string, string> = {
    promoted: "Permission found → moved to pending-review for your review",
    "still-needs-permission": "Still needs permission — no grant on record yet",
    "private-minor": "Private / minor / declined — kept fail-closed (cannot post)",
    unchanged: "No change — this package has already been reviewed",
  };
  redirect(`/admin/content-packages/${shareId}?ok=${encodeURIComponent(MESSAGES[res.outcome] ?? "re-checked")}`);
}

// Create a PLANNED social_posts row from an approved package. Does NOT post anywhere.
// Allowed only when the package is approved-by-hicrete (re-checked server-side).
export async function createPlannedPostAction(shareId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!ID_RE.test(shareId)) redirect("/admin/content-packages");
  const platform = String(formData.get("platform") ?? "");
  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
    redirect(`/admin/content-packages/${shareId}?err=${encodeURIComponent("invalid platform")}`);
  }
  let supabase;
  try { supabase = getSupabaseAdmin(); } catch {
    redirect(`/admin/content-packages/${shareId}?err=${encodeURIComponent("supabase not configured")}`);
  }
  const { data, error } = await supabase
    .from("admin_content_packages")
    .select("id,status,recipient_first_name,genre,language,share_id,share_page_url")
    .eq("share_id", shareId).limit(1);
  if (error) redirect(`/admin/content-packages/${shareId}?err=${encodeURIComponent(error.message)}`);
  const pkg = data?.[0];
  if (!pkg) redirect(`/admin/content-packages/${shareId}?err=${encodeURIComponent("package not found")}`);
  if (pkg.status !== "approved-by-hicrete") {
    redirect(`/admin/content-packages/${shareId}?err=${encodeURIComponent("only approved-by-hicrete packages can create a planned post")}`);
  }
  const caps = suggestedContent(pkg).captions;
  const captionKey: "tiktok" | "instagram" | "youtube" =
    platform === "tiktok" ? "tiktok" : platform === "youtube_shorts" ? "youtube" : "instagram"; // facebook → instagram copy
  const res = await createPost({ platform, share_id: shareId, package_id: pkg.id ?? null, caption: caps[captionKey], status: "planned" });
  redirect(res.ok
    ? `/admin/content-packages/${shareId}?ok=${encodeURIComponent("planned " + platform + " post created")}`
    : `/admin/content-packages/${shareId}?err=${encodeURIComponent(res.error)}`);
}
