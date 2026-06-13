import type { Metadata } from "next";
import { isAuthed } from "@/lib/admin-auth";
import AdminNav from "./_nav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin — Sing My Birthday",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed();
  return (
    <div className="min-h-screen bg-neutral-950 text-sm text-neutral-100">
      {authed && <AdminNav />}
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
