// Server-only data + rules for the admin Content Packages tab (Phase B).
// Reads/writes ONLY admin_content_packages + admin_content_approvals via the
// service role. Never touches KV or promo_permissions. Approval is fail-closed.

import { getSupabaseAdmin } from "./supabase-admin";

export type PackageRow = {
  id: string;
  share_id: string;
  permission_bucket: string;
  status: string;
  recipient_first_name: string | null;
  genre: string | null;
  language: string | null;
  template: string | null;
  video_url: string | null;
  audio_url: string | null;
  thumbnail_url: string | null;
  share_page_url: string | null;
  promo_granted: boolean;
  is_minor_recipient: boolean;
  permission_text_version: string | null;
  policy_version: string | null;
  packaged_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ApprovalRow = {
  id: string;
  action: string;
  actor: string | null;
  note: string | null;
  created_at: string;
};

export type AdminAction = "approve" | "decline" | "reset-review" | "mark-posted";

export const PACKAGE_STATUSES = [
  "needs-permission",
  "private-share-only",
  "approved-for-promo",
  "pending-review",
  "approved-by-hicrete",
  "declined-by-hicrete",
  "posted",
] as const;
export const PERMISSION_BUCKETS = ["needs-permission", "private-share-only", "approved-for-promo"] as const;

const PKG_COLS =
  "id,share_id,permission_bucket,status,recipient_first_name,genre,language,template,video_url,audio_url,thumbnail_url,share_page_url,promo_granted,is_minor_recipient,permission_text_version,policy_version,packaged_at,created_at,updated_at";

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table|schema cache|does not exist/i.test(error.message || "")
  );
}

const MISSING_MESSAGE = "Content package tables are not applied yet. Apply Phase B migration.";

// ── Pure action-rules (no IO — unit-testable). Fail-closed by default. ───────
export function evaluateAction(
  pkg: Pick<PackageRow, "permission_bucket" | "promo_granted" | "is_minor_recipient" | "status">,
  action: AdminAction,
): { allowed: boolean; nextStatus?: PackageRow["status"]; reason?: string } {
  const reviewable = pkg.permission_bucket === "approved-for-promo";
  const publicOk = reviewable && pkg.promo_granted === true && pkg.is_minor_recipient === false;
  const s = pkg.status;

  switch (action) {
    case "approve":
      if (!publicOk)
        return { allowed: false, reason: "Approve requires permission_bucket=approved-for-promo, promo_granted=true, is_minor_recipient=false" };
      if (s !== "pending-review" && s !== "declined-by-hicrete")
        return { allowed: false, reason: `Cannot approve from status "${s}"` };
      return { allowed: true, nextStatus: "approved-by-hicrete" };
    case "decline":
      if (!reviewable) return { allowed: false, reason: "Not in the review queue (bucket is not approved-for-promo)" };
      if (s !== "pending-review" && s !== "approved-by-hicrete")
        return { allowed: false, reason: `Cannot decline from status "${s}"` };
      return { allowed: true, nextStatus: "declined-by-hicrete" };
    case "reset-review":
      if (!reviewable) return { allowed: false, reason: "Not in the review queue (bucket is not approved-for-promo)" };
      if (s !== "approved-by-hicrete" && s !== "declined-by-hicrete")
        return { allowed: false, reason: `Cannot reset from status "${s}"` };
      return { allowed: true, nextStatus: "pending-review" };
    case "mark-posted":
      if (s !== "approved-by-hicrete") return { allowed: false, reason: 'Mark posted is only allowed from "approved-by-hicrete"' };
      return { allowed: true, nextStatus: "posted" };
    default:
      return { allowed: false, reason: "unknown action" };
  }
}

export type ListResult =
  | { ok: true; rows: PackageRow[] }
  | { ok: false; missing: true; message: string }
  | { ok: false; missing: false; error: string };

export async function listPackages(filters: {
  status?: string;
  permission_bucket?: string;
  share_id?: string;
}): Promise<ListResult> {
  try {
    const supabase = getSupabaseAdmin();
    let q = supabase.from("admin_content_packages").select(PKG_COLS);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.permission_bucket) q = q.eq("permission_bucket", filters.permission_bucket);
    if (filters.share_id) q = q.eq("share_id", filters.share_id);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) {
      if (isMissingTableError(error)) return { ok: false, missing: true, message: MISSING_MESSAGE };
      return { ok: false, missing: false, error: error.message };
    }
    return { ok: true, rows: (data ?? []) as PackageRow[] };
  } catch (e) {
    return { ok: false, missing: false, error: e instanceof Error ? e.message : "query failed" };
  }
}

export type DetailResult =
  | { ok: true; pkg: PackageRow; approvals: ApprovalRow[] }
  | { ok: false; missing: true; message: string }
  | { ok: false; missing: false; error: string }
  | { ok: false; notFound: true };

export async function getPackageDetail(shareId: string): Promise<DetailResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("admin_content_packages").select(PKG_COLS).eq("share_id", shareId).limit(1);
    if (error) {
      if (isMissingTableError(error)) return { ok: false, missing: true, message: MISSING_MESSAGE };
      return { ok: false, missing: false, error: error.message };
    }
    const pkg = (data?.[0] as PackageRow | undefined) ?? null;
    if (!pkg) return { ok: false, notFound: true };
    const { data: ap, error: apErr } = await supabase
      .from("admin_content_approvals")
      .select("id,action,actor,note,created_at")
      .eq("package_id", pkg.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (apErr && !isMissingTableError(apErr)) return { ok: false, missing: false, error: apErr.message };
    return { ok: true, pkg, approvals: (ap ?? []) as ApprovalRow[] };
  } catch (e) {
    return { ok: false, missing: false, error: e instanceof Error ? e.message : "query failed" };
  }
}

export type RecordResult = { ok: true; nextStatus: string } | { ok: false; missing?: boolean; error: string };

// Apply an action: re-load the row, re-check rules SERVER-SIDE (fail-closed),
// update status, then append an immutable approvals row.
export async function recordAction(
  shareId: string,
  action: AdminAction,
  note: string | null,
  actor = "admin",
): Promise<RecordResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_content_packages")
      .select("id,permission_bucket,promo_granted,is_minor_recipient,status")
      .eq("share_id", shareId)
      .limit(1);
    if (error) {
      if (isMissingTableError(error)) return { ok: false, missing: true, error: MISSING_MESSAGE };
      return { ok: false, error: error.message };
    }
    const pkg = data?.[0] as
      | Pick<PackageRow, "id" | "permission_bucket" | "promo_granted" | "is_minor_recipient" | "status">
      | undefined;
    if (!pkg) return { ok: false, error: "package not found" };

    const verdict = evaluateAction(pkg, action);
    if (!verdict.allowed || !verdict.nextStatus) return { ok: false, error: verdict.reason || "action not allowed" };

    const { error: upErr } = await supabase
      .from("admin_content_packages")
      .update({ status: verdict.nextStatus })
      .eq("id", pkg.id);
    if (upErr) return { ok: false, error: upErr.message };

    const { error: apErr } = await supabase
      .from("admin_content_approvals")
      .insert({ package_id: pkg.id, action, actor, note: note || null });
    if (apErr) return { ok: false, error: `status updated but audit insert failed: ${apErr.message}` };

    return { ok: true, nextStatus: verdict.nextStatus };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "action failed" };
  }
}
