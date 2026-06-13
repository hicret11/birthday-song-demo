import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listPackages, PACKAGE_STATUSES, PERMISSION_BUCKETS } from "@/lib/admin-packages";
import {
  Badge, BucketBadge, Callout, Panel, StatCard, StatGrid, StatusBadge,
  inputCls, btnCls, linkBtnCls, tableCls, theadCls, trCls, fmtTs,
} from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filters = { status?: string; permission_bucket?: string; share_id?: string };

export default async function ContentPackagesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;
  const result = await listPackages({ status: sp.status, permission_bucket: sp.permission_bucket, share_id: sp.share_id });

  const rows = result.ok ? result.rows : [];
  const by = (s: string) => rows.filter((r) => r.status === s).length;
  const blocked = rows.filter((r) => r.permission_bucket !== "approved-for-promo").length;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Content Packages</h1>
        <span className="text-xs text-neutral-500">Hicrete review queue</span>
      </div>
      <p className="mb-5 text-xs text-neutral-500">Post-ready song/share packages. Only <span className="font-mono text-neutral-400">approved-for-promo</span> packages can be reviewed for posting; everything else is fail-closed.</p>

      {result.ok && (
        <StatGrid>
          <StatCard label="Total" value={rows.length} />
          <StatCard label="Pending review" value={by("pending-review")} hint="awaiting Hicrete" />
          <StatCard label="Approved" value={by("approved-by-hicrete")} hint="ready to post" />
          <StatCard label="Posted" value={by("posted")} />
          <StatCard label="Blocked" value={blocked} hint="needs-permission / private" />
        </StatGrid>
      )}

      {/* Workflow legend */}
      <Panel title="Workflow">
        <ul className="grid grid-cols-1 gap-1 text-xs text-neutral-400 sm:grid-cols-2">
          <li><BucketBadge bucket="needs-permission" /> → cannot post — no promo permission on record.</li>
          <li><BucketBadge bucket="approved-for-promo" /> → reviewable: <span className="text-neutral-300">Approve</span> or <span className="text-neutral-300">Decline</span>.</li>
          <li><StatusBadge status="approved-by-hicrete" /> → can <span className="text-neutral-300">Mark posted</span>.</li>
          <li><BucketBadge bucket="private-share-only" /> → fail-closed (declined or minor recipient).</li>
        </ul>
      </Panel>

      <Panel title="Filters">
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Status
            <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
              <option value="">any</option>
              {PACKAGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Bucket
            <select name="permission_bucket" defaultValue={sp.permission_bucket ?? ""} className={inputCls}>
              <option value="">any</option>
              {PERMISSION_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input type="text" name="share_id" defaultValue={sp.share_id ?? ""} className={inputCls} /></label>
          <button type="submit" className={btnCls}>Filter</button>
          <Link href="/admin/content-packages" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
        </form>
      </Panel>

      {!result.ok && result.missing && (
        <Callout tone="blue" title="Not set up yet — this is expected on preview">
          <p>The Phase B table <span className="font-mono">admin_content_packages</span> hasn&apos;t been created in this environment. An empty list here is normal, not an error.</p>
        </Callout>
      )}
      {!result.ok && !result.missing && <Callout tone="red" title="Query error">{result.error}</Callout>}

      {result.ok && rows.length === 0 && (
        <Callout tone="neutral" title="No packages yet">
          <p>Generate packages from the CLI (read-only on KV/Supabase, writes only this table):</p>
          <pre className="mt-1 overflow-x-auto rounded bg-neutral-950 px-3 py-2 font-mono text-[11px] text-neutral-300">npm run content:package-share -- --share-id=&lt;id&gt; --record-admin</pre>
        </Callout>
      )}

      {result.ok && rows.length > 0 && (
        <>
          <p className="mb-2 text-xs text-neutral-500">{rows.length} package(s).</p>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className={tableCls}>
              <thead><tr className={theadCls}>
                <th className="px-3 py-2">packaged</th><th className="px-3 py-2">recipient</th>
                <th className="px-3 py-2">genre / lang</th><th className="px-3 py-2">bucket</th>
                <th className="px-3 py-2">status</th><th className="px-3 py-2">media</th>
                <th className="px-3 py-2">share_id</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={trCls}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-400">{fmtTs(p.packaged_at ?? p.created_at)}</td>
                    <td className="px-3 py-1.5 font-medium text-neutral-100">{p.recipient_first_name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-400">{[p.genre, p.language].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-1.5"><BucketBadge bucket={p.permission_bucket} />{p.is_minor_recipient ? <span className="ml-1"><Badge tone="red">minor</Badge></span> : null}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-1.5">
                      <span className="flex gap-2">
                        {p.share_page_url ? <a href={p.share_page_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">share↗</a> : null}
                        {p.video_url ? <a href={p.video_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">mp4↗</a> : p.audio_url ? <a href={p.audio_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">audio↗</a> : null}
                        {!p.share_page_url && !p.video_url && !p.audio_url ? <span className="text-neutral-600">—</span> : null}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-neutral-400">{p.share_id}</td>
                    <td className="px-3 py-1.5 text-right"><Link href={`/admin/content-packages/${encodeURIComponent(p.share_id)}`} className={linkBtnCls}>Review →</Link></td>
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
