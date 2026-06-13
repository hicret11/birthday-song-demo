import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  Badge, Callout, EventBadge, Panel, StatCard, StatGrid,
  inputCls, btnCls, tableCls, theadCls, trCls, fmtTs, cutoffIso, maskEmail,
} from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 100;

type Filters = { from?: string; to?: string; email?: string; share_id?: string; venue_slug?: string; reveal?: string };
type Row = {
  occurred_at: string | null; event_type: string | null; recipient_name: string | null;
  language: string | null; genre: string | null; share_id: string | null;
  venue_slug: string | null; email: string | null;
};

function applyFilters<T>(q: T, sp: Filters): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let b: any = q;
  if (sp.share_id) b = b.eq("share_id", sp.share_id);
  if (sp.venue_slug) b = b.eq("venue_slug", sp.venue_slug);
  if (sp.email) b = b.ilike("email", `%${sp.email}%`);
  if (sp.from) b = b.gte("occurred_at", sp.from);
  if (sp.to) b = b.lte("occurred_at", sp.to);
  return b as T;
}

async function countFiltered(sp: Filters, sinceHours?: number): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  let q = applyFilters(supabase.from("generation_events").select("*", { count: "exact", head: true }), sp);
  if (sinceHours) q = q.gte("occurred_at", cutoffIso(sinceHours));
  const { count, error } = await q;
  return error ? null : (count ?? 0);
}

export default async function GenerationsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;
  const reveal = sp.reveal === "1";

  let rows: Row[] = [];
  let err: string | null = null;
  let total: number | null = 0, c24: number | null = 0, c7d: number | null = 0;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await applyFilters(
      supabase.from("generation_events").select("occurred_at,event_type,recipient_name,language,genre,share_id,venue_slug,email"),
      sp,
    ).order("occurred_at", { ascending: false }).limit(LIMIT);
    if (error) err = error.message;
    else {
      rows = (data ?? []) as Row[];
      [total, c24, c7d] = await Promise.all([countFiltered(sp), countFiltered(sp, 24), countFiltered(sp, 24 * 7)]);
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "query failed";
  }

  const uniqEmails = new Set(rows.map((r) => r.email).filter(Boolean)).size;
  const uniqShares = new Set(rows.map((r) => r.share_id).filter(Boolean)).size;
  const revealQS = new URLSearchParams({ ...sp, reveal: reveal ? "" : "1" } as Record<string, string>);
  if (reveal) revealQS.delete("reveal");

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Events</h1>
        <span className="text-xs text-neutral-500">durable server-side activity log</span>
      </div>
      <p className="mb-5 text-xs text-neutral-500">Server-logged generation/share/playback events. Newest first.</p>

      <StatGrid>
        <StatCard label="Total events" value={total ?? "—"} />
        <StatCard label="Last 24h" value={c24 ?? "—"} />
        <StatCard label="Last 7 days" value={c7d ?? "—"} />
        <StatCard label="Unique emails" value={uniqEmails} hint="in shown rows" />
        <StatCard label="Unique shares" value={uniqShares} hint="in shown rows" />
      </StatGrid>

      <Panel title="Filters">
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Email<input type="text" name="email" defaultValue={sp.email ?? ""} placeholder="search…" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input type="text" name="share_id" defaultValue={sp.share_id ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Venue<input type="text" name="venue_slug" defaultValue={sp.venue_slug ?? ""} className={inputCls} /></label>
          {reveal && <input type="hidden" name="reveal" value="1" />}
          <button type="submit" className={btnCls}>Filter</button>
          <Link href="/admin/generations" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
        </form>
      </Panel>

      {err && <p className="mb-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">Query error: {err}</p>}

      {!err && rows.length === 0 && (
        <Callout tone="neutral" title="No generation events found">
          <p>Durable event logging only captures activity <span className="font-medium text-neutral-200">after the event table was deployed</span>, so earlier activity isn&apos;t recorded here.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/captures" className={btnCls}>View Capture History →</Link>
            <Link href="/admin/shares" className="rounded border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800">Look up a share by ID</Link>
          </div>
        </Callout>
      )}

      {rows.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Showing {rows.length}{rows.length === LIMIT ? ` (capped at ${LIMIT})` : ""}.</span>
            <Link href={`/admin/generations?${revealQS.toString()}`} className="hover:underline">{reveal ? "Mask emails" : "Reveal emails"}</Link>
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className={tableCls}>
              <thead><tr className={theadCls}>
                <th className="px-3 py-2">occurred_at</th><th className="px-3 py-2">event</th>
                <th className="px-3 py-2">recipient</th><th className="px-3 py-2">lang</th>
                <th className="px-3 py-2">genre</th><th className="px-3 py-2">share_id</th>
                <th className="px-3 py-2">venue</th><th className="px-3 py-2">email</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={trCls}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-400">{fmtTs(r.occurred_at)}</td>
                    <td className="px-3 py-1.5"><EventBadge type={r.event_type} /></td>
                    <td className="px-3 py-1.5 text-neutral-200">{r.recipient_name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-400">{r.language ?? "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-400">{r.genre ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono">{r.share_id ? <Link href={`/admin/shares?share_id=${encodeURIComponent(r.share_id)}`} className="text-fuchsia-400 hover:underline">{r.share_id}</Link> : "—"}</td>
                    <td className="px-3 py-1.5">{r.venue_slug ? <Badge tone="blue">{r.venue_slug}</Badge> : <span className="text-neutral-600">—</span>}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-neutral-500">{maskEmail(r.email, reveal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
