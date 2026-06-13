import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  redirect("/admin/generations");
}
