"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { setBookingStatus, type CastStatus } from "@/lib/cast";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// The only statuses a human concierge sets by hand on a live booking. (pending /
// scheduled / calling / failed are system-driven and never chosen here.)
const MANUAL_STATUSES: CastStatus[] = ["contacted", "confirmed", "completed", "canceled"];

export async function setLiveStatusAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  if (!UUID_RE.test(id)) redirect("/admin/live?err=bad-id");

  const status = String(formData.get("status") ?? "");
  if (!(MANUAL_STATUSES as string[]).includes(status)) {
    redirect("/admin/live?err=bad-status");
  }

  const ok = await setBookingStatus(id, status as CastStatus);
  redirect(ok ? "/admin/live?ok=1" : "/admin/live?err=update-failed");
}
