"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { updateLead } from "@/lib/admin-outreach";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

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
