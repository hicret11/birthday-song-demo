import type { Metadata } from "next";
import Link from "next/link";
import { isAuthed } from "@/lib/admin-auth";
import { logoutAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin — Sing My Birthday",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed();
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 text-sm">
      {authed && (
        <nav className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
          <span className="font-semibold text-neutral-400">SMB Admin</span>
          <Link href="/admin/generations" className="hover:underline">Events</Link>
          <Link href="/admin/captures" className="hover:underline">Captures</Link>
          <Link href="/admin/shares" className="hover:underline">Shares</Link>
          <Link href="/admin/content-packages" className="hover:underline">Content Packages</Link>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800">
              Logout
            </button>
          </form>
        </nav>
      )}
      <main className="p-4">{children}</main>
    </div>
  );
}
