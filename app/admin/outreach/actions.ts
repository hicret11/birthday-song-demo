"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { updateLead, logActivity } from "@/lib/admin-outreach";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// List-page inline edit → returns to the list.
export async function updateLeadAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(id)) redirect("/admin/outreach?err=bad-id");
  const res = await updateLead(id, {
    outreach_status: String(formData.get("outreach_status") ?? "") || undefined,
    owner: String(formData.get("owner") ?? "").slice(0, 80),
    notes: String(formData.get("notes") ?? "").slice(0, 1000),
  });
  redirect(res.ok ? "/admin/outreach?ok=1" : `/admin/outreach?err=${encodeURIComponent(res.error)}`);
}

// Detail-page edit → stays on the detail page.
export async function updateLeadDetailAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(id)) redirect("/admin/outreach");
  const res = await updateLead(id, {
    outreach_status: String(formData.get("outreach_status") ?? "") || undefined,
    owner: String(formData.get("owner") ?? "").slice(0, 80),
    notes: String(formData.get("notes") ?? "").slice(0, 1000),
  });
  redirect(`/admin/outreach/${id}?${res.ok ? "ok=1" : `err=${encodeURIComponent(res.error)}`}`);
}

// Record that a draft was prepared (history) — does NOT send anything.
export async function saveDraftAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(id)) redirect("/admin/outreach");
  const templateKey = String(formData.get("template_key") ?? "").slice(0, 64) || null;
  const res = await logActivity({ leadId: id, action: "drafted", template_key: templateKey });
  redirect(`/admin/outreach/${id}?${res.ok ? "ok=draft-logged" : `err=${encodeURIComponent(res.error || "log failed")}`}${templateKey ? `&template=${encodeURIComponent(templateKey)}` : ""}`);
}

// Mark a lead contacted: sets status=contacted AND logs activity. No email is sent.
export async function markContactedAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(id)) redirect("/admin/outreach");
  const templateKey = String(formData.get("template_key") ?? "").slice(0, 64) || null;
  const note = String(formData.get("note") ?? "").slice(0, 1000) || null;
  const upd = await updateLead(id, { outreach_status: "contacted" });
  if (!upd.ok) redirect(`/admin/outreach/${id}?err=${encodeURIComponent(upd.error)}`);
  await logActivity({ leadId: id, action: "contacted", template_key: templateKey, note });
  redirect(`/admin/outreach/${id}?ok=marked-contacted`);
}
