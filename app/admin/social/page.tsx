import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listPosts, SOCIAL_PLATFORMS, SOCIAL_STATUSES, type SocialPost } from "@/lib/admin-social";
import { Badge, Callout, Panel, StatCard, StatGrid, inputCls, btnCls, tableCls, theadCls, trCls, fmtTs } from "../_ui";
import { createPostAction, updatePostStatusAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filters = { platform?: string; status?: string; ok?: string; err?: string };

const STATUS_TONE: Record<string, "neutral" | "amber" | "green"> = { planned: "amber", posted: "green", skipped: "neutral" };
const PLAT_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube_shorts: "YT Shorts", facebook: "Facebook" };

export default async function SocialPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;
  const result = await listPosts({ platform: sp.platform, status: sp.status });
  const rows: SocialPost[] = result.ok ? result.rows : [];
  const by = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Social — Posting Tracker</h1>
        <span className="text-xs text-neutral-500">manual log — Hicrete</span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">Track planned / posted / skipped posts by hand. No auto-posting, no social APIs, no scraping — this is a record-keeping tool only.</p>

      {sp.ok && <div className="mb-3"><Callout tone="green">Saved.</Callout></div>}
      {sp.err && <div className="mb-3"><Callout tone="red">{sp.err}</Callout></div>}

      {result.ok && (
        <StatGrid>
          <StatCard label="Total" value={rows.length} />
          <StatCard label="Planned" value={by("planned")} />
          <StatCard label="Posted" value={by("posted")} />
          <StatCard label="Skipped" value={by("skipped")} />
        </StatGrid>
      )}

      <Panel title="Log a post">
        <form action={createPostAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Platform
            <select name="platform" required defaultValue="tiktok" className={inputCls}>
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{PLAT_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Status
            <select name="status" defaultValue="planned" className={inputCls}>
              {SOCIAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input name="share_id" className={`${inputCls} w-28`} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Post URL<input name="post_url" type="url" placeholder="https://…" className={`${inputCls} w-56`} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Posted at<input name="posted_at" type="date" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Caption<input name="caption" className={`${inputCls} w-56`} /></label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Notes<input name="notes" className={`${inputCls} w-40`} /></label>
          <button type="submit" className={btnCls}>Add</button>
        </form>
      </Panel>

      <Panel title="Filters">
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Platform
            <select name="platform" defaultValue={sp.platform ?? ""} className={inputCls}>
              <option value="">any</option>
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{PLAT_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Status
            <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
              <option value="">any</option>
              {SOCIAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="submit" className={btnCls}>Filter</button>
          <Link href="/admin/social" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
        </form>
      </Panel>

      {!result.ok && result.missing && <Callout tone="blue" title="Not set up yet — expected on preview">{result.message}</Callout>}
      {!result.ok && !result.missing && <Callout tone="red" title="Query error">{result.error}</Callout>}

      {result.ok && rows.length === 0 && (
        <Callout tone="neutral" title="No posts logged yet">Use “Log a post” above to start tracking what Hicrete posts (or plans/skips) across platforms.</Callout>
      )}

      {result.ok && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className={tableCls}>
            <thead><tr className={theadCls}>
              <th className="px-3 py-2">created</th><th className="px-3 py-2">platform</th>
              <th className="px-3 py-2">status</th><th className="px-3 py-2">share_id</th>
              <th className="px-3 py-2">post</th><th className="px-3 py-2">posted_at</th>
              <th className="px-3 py-2">caption</th><th className="px-3 py-2">set status</th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={trCls}>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-500">{fmtTs(p.created_at)}</td>
                  <td className="px-3 py-1.5"><Badge tone="blue">{PLAT_LABEL[p.platform] ?? p.platform}</Badge></td>
                  <td className="px-3 py-1.5"><Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge></td>
                  <td className="px-3 py-1.5 font-mono text-neutral-400">{p.share_id ?? "—"}</td>
                  <td className="px-3 py-1.5">{p.post_url ? <a href={p.post_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">open↗</a> : <span className="text-neutral-600">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-500">{p.posted_at ? fmtTs(p.posted_at) : "—"}</td>
                  <td className="max-w-[16rem] truncate px-3 py-1.5 text-neutral-400" title={p.caption ?? ""}>{p.caption ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <form action={updatePostStatusAction.bind(null, p.id)} className="flex items-center gap-1">
                      <select name="status" defaultValue={p.status} className={`${inputCls} py-0.5`}>
                        {SOCIAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="submit" className="rounded bg-neutral-700 px-2 py-0.5 text-xs font-semibold text-white hover:bg-neutral-600">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
