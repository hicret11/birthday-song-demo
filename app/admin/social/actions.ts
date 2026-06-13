"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { createPost, updatePostStatus } from "@/lib/admin-social";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function createPostAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const res = await createPost({
    platform: String(formData.get("platform") ?? ""),
    share_id: String(formData.get("share_id") ?? "").slice(0, 64) || null,
    post_url: String(formData.get("post_url") ?? "").slice(0, 500) || null,
    caption: String(formData.get("caption") ?? "").slice(0, 2000) || null,
    status: String(formData.get("status") ?? "planned"),
    posted_at: String(formData.get("posted_at") ?? "") || null,
    notes: String(formData.get("notes") ?? "").slice(0, 1000) || null,
  });
  redirect(res.ok ? "/admin/social?ok=1" : `/admin/social?err=${encodeURIComponent(res.error)}`);
}

export async function updatePostStatusAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(id)) redirect("/admin/social?err=bad-id");
  const res = await updatePostStatus(id, String(formData.get("status") ?? ""));
  redirect(res.ok ? "/admin/social?ok=1" : `/admin/social?err=${encodeURIComponent(res.error)}`);
}
