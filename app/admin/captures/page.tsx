import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  Badge, Panel, StatCard, StatGrid,
  inputCls, btnCls, tableCls, theadCls, trCls, fmtTs, cutoffIso,
} from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 100;

type Filters = { from?: string; to?: string; email?: string; venue_slug?: string };
type Row = {
  id: string; email: string | null; recipient_name: string | null;
  target_age: number | null; target_under_13: boolean | null; target_is_minor: boolean | null;
  language: string | null; genre: string | null; relationship: string | null;
  marketing_reminder_consent: boolean | null; raffle_opt_in: boolean | null;
  venue_slug: string | null; country: string | null; region: string | null;
  created_at: string | null; capture_version: string | null;
};

const COLS =
  "id,email,recipient_name,target_age,target_under_13,target_is_minor,language,genre,relationship,marketing_reminder_consent,raffle_opt_in,venue_slug,country,region,created_at,capture_version";

function applyFilters<T>(q: T, sp: Filters): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let b: any = q;
  if (sp.venue_slug) b = b.eq("venue_slug", sp.venue_slug);
  if (sp.email) b = b.ilike("email", `%${sp.email}%`);
  if (sp.from) b = b.gte("created_at", sp.from);
  if (sp.to) b = b.lte("created_at", sp.to);
  return b as T;
}

async function count(opts: { sp: Filters; sinceHours?: number; eq?: [string, unknown] }): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  let q = applyFilters(supabase.from("waitlist_leads").select("*", { count: "exact", head: true }), opts.sp);
  if (opts.sinceHours) q = q.gte("created_at", cutoffIso(opts.sinceHours));
  if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
  const { count, error } = await q;
  return error ? null : (count ?? 0);
}

export default async function CapturesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;

  let rows: Row[] = [];
  let err: string | null = null;
  let total: number | null = 0, c24: number | null = 0, c7d: number | null = 0, under13: number | null = 0, raffle: number | null = 0;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await applyFilters(supabase.from("waitlist_leads").select(COLS), sp)
      .order("created_at", { ascending: false }).limit(LIMIT);
    if (error) err = error.message;
    else {
      rows = (data ?? []) as Row[];
      [total, c24, c7d, under13, raffle] = await Promise.all([
        count({ sp }), count({ sp, sinceHours: 24 }), count({ sp, sinceHours: 24 * 7 }),
        count({ sp, eq: ["target_under_13", true] }), count({ sp, eq: ["raffle_opt_in", true] }),
      ]);
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "query failed";
  }

  const uniqEmails = new Set(rows.map((r) => r.email).filter(Boolean)).size;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Capture History</h1>
        <span className="text-xs text-neutral-500">lead / capture records — not completed-song history</span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">From <span className="font-mono">waitlist_leads</span>: form/wait-state captures. A row here does not mean a song was generated or shared.</p>

      <StatGrid>
        <StatCard label="Total captures" value={total ?? "—"} />
        <StatCard label="Last 24h" value={c24 ?? "—"} />
        <StatCard label="Last 7 days" value={c7d ?? "—"} />
        <StatCard label="Under-13 targets" value={under13 ?? "—"} hint="child-flow" />
        <StatCard label="Raffle opt-ins" value={raffle ?? "—"} />
      </StatGrid>

      <Panel title="Filters">
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">From<input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">To<input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Email<input type="text" name="email" defaultValue={sp.email ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Venue<input type="text" name="venue_slug" defaultValue={sp.venue_slug ?? ""} className={inputCls} /></label>
          <button type="submit" className={btnCls}>Filter</button>
          <Link href="/admin/captures" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
        </form>
      </Panel>

      {err && <p className="mb-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">Query error: {err}</p>}

      {!err && rows.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">No capture records match the current filters.</div>
      )}

      {rows.length > 0 && (
        <>
          <p className="mb-2 text-xs text-neutral-500">Showing {rows.length}{rows.length === LIMIT ? ` (capped at ${LIMIT})` : ""}, newest first.</p>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className={tableCls}>
              <thead><tr className={theadCls}>
                <th className="px-2.5 py-1.5">created_at</th><th className="px-2.5 py-1.5">recipient</th>
                <th className="px-2.5 py-1.5">email</th><th className="px-2.5 py-1.5">age</th>
                <th className="px-2.5 py-1.5">lang</th><th className="px-2.5 py-1.5">genre</th>
                <th className="px-2.5 py-1.5">relationship</th><th className="px-2.5 py-1.5">venue</th>
                <th className="px-2.5 py-1.5">geo</th><th className="px-2.5 py-1.5">consent</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={trCls}>
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-neutral-400">{fmtTs(r.created_at)}</td>
                    <td className="px-2.5 py-1.5">{r.recipient_name ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-neutral-400">{r.email ?? "—"}</td>
                    <td className="px-2.5 py-1.5">
                      {r.target_age ?? "—"}{" "}
                      {r.target_under_13 ? <Badge tone="red">under 13</Badge> : r.target_is_minor ? <Badge tone="amber">minor</Badge> : null}
                    </td>
                    <td className="px-2.5 py-1.5">{r.language ?? "—"}</td>
                    <td className="px-2.5 py-1.5">{r.genre ?? "—"}</td>
                    <td className="px-2.5 py-1.5">{r.relationship ?? "—"}</td>
                    <td className="px-2.5 py-1.5">{r.venue_slug ? <Badge tone="blue">{r.venue_slug}</Badge> : "—"}</td>
                    <td className="px-2.5 py-1.5 text-neutral-400">{[r.country, r.region].filter(Boolean).join("/") || "—"}</td>
                    <td className="px-2.5 py-1.5">
                      <span className="flex flex-wrap gap-1">
                        {r.marketing_reminder_consent && <Badge tone="green">mktg</Badge>}
                        {r.raffle_opt_in && <Badge tone="purple">raffle</Badge>}
                        {!r.marketing_reminder_consent && !r.raffle_opt_in && <span className="text-neutral-600">—</span>}
                      </span>
                    </td>
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
