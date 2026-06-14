import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listLeads, type OutreachLead } from "@/lib/admin-outreach";
import { OUTREACH_STATUSES, getProviderName } from "@/lib/outreach/provider";
import { Badge, Callout, Panel, StatCard, StatGrid, inputCls, btnCls, tableCls, theadCls, trCls, fmtTs } from "../_ui";
import { updateLeadAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filters = { city?: string; category?: string; status?: string; minRating?: string; q?: string; ok?: string; err?: string };

const STATUS_TONE: Record<string, "neutral" | "blue" | "amber" | "green" | "red" | "purple"> = {
  new: "blue", shortlisted: "amber", contacted: "purple", replied: "green", partnered: "green", not_relevant: "neutral",
};

export default async function OutreachPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;
  const result = await listLeads({ city: sp.city, category: sp.category, status: sp.status, minRating: sp.minRating, q: sp.q });
  const rows: OutreachLead[] = result.ok ? result.rows : [];
  const by = (s: string) => rows.filter((r) => r.outreach_status === s).length;
  const providerConfigured = getProviderName() !== "none";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Outreach <span className="ml-1 align-middle"><Badge tone="blue">🇦🇪 UAE</Badge></span></h1>
        <span className="text-xs text-neutral-500">B2B venue / partner leads — Alejandro</span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">UAE birthday/event venues, party planners, bakeries, play areas, hotels &amp; more. Business-level public contact data only.</p>

      {sp.ok && <div className="mb-3"><Callout tone="green">Lead updated.</Callout></div>}
      {sp.err && <div className="mb-3"><Callout tone="red">{sp.err}</Callout></div>}

      {result.ok && (
        <StatGrid>
          <StatCard label="Total leads" value={rows.length} />
          <StatCard label="New" value={by("new")} />
          <StatCard label="Shortlisted" value={by("shortlisted")} />
          <StatCard label="Contacted" value={by("contacted")} />
          <StatCard label="Replied / Partnered" value={by("replied") + by("partnered")} />
        </StatGrid>
      )}

      <div className="mb-4">
        <Callout tone={providerConfigured ? "green" : "amber"} title={providerConfigured ? "Auto-discovery configured" : "Outreach source not configured"}>
          {providerConfigured
            ? <p>A provider is configured; the daily refresh can populate leads automatically.</p>
            : <>
                <p>No discovery provider is set — that&apos;s fine. Add leads manually via the import CLI (no API keys, no scraping):</p>
                <pre className="mt-1 overflow-x-auto rounded bg-neutral-950 px-3 py-2 font-mono text-[11px] text-neutral-300">npm run outreach:import -- --file=scripts/outreach-leads.example.json</pre>
                <p className="text-xs opacity-80">CSV or JSON supported. Dedup-upsert; status/owner/notes you set here are preserved on re-import.</p>
              </>}
        </Callout>
      </div>

      <Panel title="Filters">
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Search<input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="business name" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">City<input type="text" name="city" defaultValue={sp.city ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Category<input type="text" name="category" defaultValue={sp.category ?? ""} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Status
            <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
              <option value="">any</option>
              {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Min rating<input type="number" step="0.1" min="0" max="5" name="minRating" defaultValue={sp.minRating ?? ""} className={`${inputCls} w-20`} /></label>
          <button type="submit" className={btnCls}>Filter</button>
          <Link href="/admin/outreach" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
        </form>
      </Panel>

      {!result.ok && result.missing && <Callout tone="blue" title="Not set up yet — expected on preview">{result.message}</Callout>}
      {!result.ok && !result.missing && <Callout tone="red" title="Query error">{result.error}</Callout>}

      {result.ok && rows.length === 0 && (
        <Callout tone="neutral" title="No leads yet">Run the import CLI above to add UAE venue leads, then refresh this page.</Callout>
      )}

      {result.ok && rows.length > 0 && (
        <>
          <p className="mb-2 text-xs text-neutral-500">{rows.length} lead(s), highest relevance first.</p>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className={tableCls}>
              <thead><tr className={theadCls}>
                <th className="px-3 py-2">business</th><th className="px-3 py-2">category</th>
                <th className="px-3 py-2">city / area</th><th className="px-3 py-2">rating</th>
                <th className="px-3 py-2">links</th><th className="px-3 py-2">score</th>
                <th className="px-3 py-2">last seen</th><th className="px-3 py-2">update (status / owner / notes)</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={trCls}>
                    <td className="px-3 py-1.5 font-medium text-neutral-100">{r.business_name}<div className="mt-0.5"><Badge tone={STATUS_TONE[r.outreach_status] ?? "neutral"}>{r.outreach_status}</Badge></div></td>
                    <td className="px-3 py-1.5 text-neutral-400">{r.category ?? "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-400">{[r.city, r.area].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-300">{r.rating ?? "—"}{r.review_count ? <span className="text-neutral-600"> ({r.review_count})</span> : null}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex flex-wrap gap-2">
                        {r.website_url && <a href={r.website_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">site↗</a>}
                        {r.google_maps_url && <a href={r.google_maps_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">maps↗</a>}
                        {r.phone && <a href={`tel:${r.phone}`} className="text-fuchsia-400 hover:underline">call</a>}
                        {!r.website_url && !r.google_maps_url && !r.phone && <span className="text-neutral-600">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-neutral-300">{r.relevance_score ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-500">{fmtTs(r.last_seen_at)}</td>
                    <td className="px-3 py-1.5">
                      <form action={updateLeadAction.bind(null, r.id)} className="flex flex-wrap items-center gap-1">
                        <select name="outreach_status" defaultValue={r.outreach_status} className={`${inputCls} py-0.5`}>
                          {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input name="owner" defaultValue={r.owner ?? ""} placeholder="owner" className={`${inputCls} w-20 py-0.5`} />
                        <input name="notes" defaultValue={r.notes ?? ""} placeholder="notes" className={`${inputCls} w-32 py-0.5`} />
                        <button type="submit" className="rounded bg-neutral-700 px-2 py-0.5 text-xs font-semibold text-white hover:bg-neutral-600">Save</button>
                      </form>
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
