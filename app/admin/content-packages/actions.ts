"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAction, type AdminAction } from "@/lib/admin-packages";

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;

async function run(shareId: string, action: AdminAction, formData: FormData): Promise<void> {
  await requireAdmin(); // server actions are directly callable — re-check auth
  if (!ID_RE.test(shareId)) redirect("/admin/content-packages");
  const note = String(formData?.get("note") ?? "").slice(0, 500) || null;
  const res = await recordAction(shareId, action, note);
  const q = res.ok
    ? `ok=${encodeURIComponent(res.nextStatus)}`
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
