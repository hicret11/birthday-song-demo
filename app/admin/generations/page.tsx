import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 200;

type Filters = { from?: string; to?: string; email?: string; share_id?: string; venue_slug?: string };
type Row = {
  occurred_at: string | null;
  event_type: string | null;
  recipient_name: string | null;
  language: string | null;
  genre: string | null;
  share_id: string | null;
  venue_slug: string | null;
  email: string | null;
};

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString().replace("T", " ").slice(0, 19);
}

export default async function GenerationsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;

  let rows: Row[] = [];
  let err: string | null = null;
  try {
    const supabase = getSupabaseAdmin();
    let q = supabase
      .from("generation_events")
      .select("occurred_at,event_type,recipient_name,language,genre,share_id,venue_slug,email");
    if (sp.share_id) q = q.eq("share_id", sp.share_id);
    if (sp.venue_slug) q = q.eq("venue_slug", sp.venue_slug);
    if (sp.email) q = q.ilike("email", `%${sp.email}%`);
    if (sp.from) q = q.gte("occurred_at", sp.from);
    if (sp.to) q = q.lte("occurred_at", sp.to);
    const { data, error } = await q.order("occurred_at", { ascending: false }).limit(LIMIT);
    if (error) err = error.message;
    else rows = (data ?? []) as Row[];
  } catch (e) {
    err = e instanceof Error ? e.message : "query failed";
  }

  const input = "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100";
  return (
    <div>
      <h1 className="mb-3 text-base font-semibold">Generations <span className="text-neutral-500">(read-only)</span></h1>

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={input} /></label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={input} /></label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Email<input type="text" name="email" defaultValue={sp.email ?? ""} className={input} /></label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input type="text" name="share_id" defaultValue={sp.share_id ?? ""} className={input} /></label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Venue<input type="text" name="venue_slug" defaultValue={sp.venue_slug ?? ""} className={input} /></label>
        <button type="submit" className="rounded bg-fuchsia-600 px-3 py-1.5 font-semibold text-white hover:bg-fuchsia-500">Filter</button>
        <Link href="/admin/generations" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
      </form>

      {err && <p className="mb-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">Query error: {err}</p>}

      <p className="mb-2 text-xs text-neutral-500">{rows.length} row(s){rows.length === LIMIT ? ` (capped at ${LIMIT})` : ""}.</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-700 text-left text-neutral-400">
              <th className="px-2 py-1">occurred_at</th><th className="px-2 py-1">event</th>
              <th className="px-2 py-1">recipient</th><th className="px-2 py-1">lang</th>
              <th className="px-2 py-1">genre</th><th className="px-2 py-1">share_id</th>
              <th className="px-2 py-1">venue</th><th className="px-2 py-1">email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-neutral-900 hover:bg-neutral-900">
                <td className="whitespace-nowrap px-2 py-1 font-mono">{fmt(r.occurred_at)}</td>
                <td className="px-2 py-1">{r.event_type ?? "—"}</td>
                <td className="px-2 py-1">{r.recipient_name ?? "—"}</td>
                <td className="px-2 py-1">{r.language ?? "—"}</td>
                <td className="px-2 py-1">{r.genre ?? "—"}</td>
                <td className="px-2 py-1 font-mono">
                  {r.share_id ? <Link href={`/admin/shares?share_id=${encodeURIComponent(r.share_id)}`} className="text-fuchsia-400 hover:underline">{r.share_id}</Link> : "—"}
                </td>
                <td className="px-2 py-1">{r.venue_slug ?? "—"}</td>
                <td className="px-2 py-1">{r.email ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && !err && (
              <tr><td colSpan={8} className="px-2 py-6 text-center text-neutral-500">No matching events.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
