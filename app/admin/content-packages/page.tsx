import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listPackages, PACKAGE_STATUSES, PERMISSION_BUCKETS } from "@/lib/admin-packages";
import { suggestedContent } from "@/lib/content-packages";
import {
  Badge, BucketBadge, Callout, Panel, StatCard, StatGrid, StatusBadge,
  inputCls, btnCls, linkBtnCls, tableCls, theadCls, trCls, fmtTs,
} from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filters = { status?: string; permission_bucket?: string; share_id?: string; view?: string };

const QUICK_FILTERS: Array<{ label: string; href: string }> = [
  { label: "Ready to post", href: "?status=approved-by-hicrete" },
  { label: "Needs review", href: "?status=pending-review" },
  { label: "Needs permission", href: "?permission_bucket=needs-permission" },
  { label: "Private / minor", href: "?permission_bucket=private-share-only" },
  { label: "Posted", href: "?status=posted" },
  { label: "All", href: "/admin/content-packages" },
];

function mediaLinks(p: { share_page_url: string | null; video_url: string | null; audio_url: string | null }) {
  return (
    <span className="flex gap-2">
      {p.share_page_url ? <a href={p.share_page_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">share↗</a> : null}
      {p.video_url ? <a href={p.video_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">mp4↗</a> : p.audio_url ? <a href={p.audio_url} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">audio↗</a> : null}
      {!p.share_page_url && !p.video_url && !p.audio_url ? <span className="text-neutral-600">—</span> : null}
    </span>
  );
}

export default async function ContentPackagesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;
  const isWeekend = sp.view === "weekend";

  // Weekend Queue pulls everything (so it can segment + count); the review table honors filters.
  const result = isWeekend
    ? await listPackages({})
    : await listPackages({ status: sp.status, permission_bucket: sp.permission_bucket, share_id: sp.share_id });

  const rows = result.ok ? result.rows : [];
  const by = (s: string) => rows.filter((r) => r.status === s).length;
  const byBucket = (b: string) => rows.filter((r) => r.permission_bucket === b).length;

  // Postable = approved-by-hicrete AND approved-for-promo bucket AND not a minor (fail-closed re-check in the view layer too).
  const postable = rows.filter(
    (r) => r.status === "approved-by-hicrete" && r.permission_bucket === "approved-for-promo" && r.is_minor_recipient !== true,
  );

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Content Packages</h1>
        <div className="flex gap-3 text-xs">
          <Link href="/admin/content-packages" className={isWeekend ? "text-neutral-500 hover:underline" : "font-semibold text-fuchsia-400"}>Review queue</Link>
          <Link href="/admin/content-packages?view=weekend" className={isWeekend ? "font-semibold text-fuchsia-400" : "text-neutral-500 hover:underline"}>⭐ Weekend Queue</Link>
        </div>
      </div>
      <p className="mb-5 text-xs text-neutral-500">Post-ready song/share packages. Only <span className="font-mono text-neutral-400">approved-for-promo</span> packages can be reviewed for posting; everything else is fail-closed.</p>

      {isWeekend && (
        <WeekendQueue
          result={result}
          postable={postable}
          counts={{
            review: by("pending-review"),
            needsPermission: byBucket("needs-permission"),
            privateMinor: byBucket("private-share-only"),
            posted: by("posted"),
          }}
        />
      )}
      {isWeekend ? null : (
      <>
      {/* Quick filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => (
          <Link key={q.label} href={q.href.startsWith("/") ? q.href : `/admin/content-packages${q.href}`} className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-fuchsia-500 hover:text-fuchsia-300">{q.label}</Link>
        ))}
      </div>

      {result.ok && (
        <StatGrid>
          <StatCard label="Ready for review" value={by("pending-review")} hint="awaiting Hicrete" />
          <StatCard label="Approved by Hicrete" value={by("approved-by-hicrete")} hint="ready to post" />
          <StatCard label="Posted" value={by("posted")} />
          <StatCard label="Needs permission" value={byBucket("needs-permission")} />
          <StatCard label="Private / minor" value={byBucket("private-share-only")} hint="fail-closed" />
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
                    <td className="px-3 py-1.5">{mediaLinks(p)}</td>
                    <td className="px-3 py-1.5 font-mono text-neutral-400">{p.share_id}</td>
                    <td className="px-3 py-1.5 text-right"><Link href={`/admin/content-packages/${encodeURIComponent(p.share_id)}`} className={linkBtnCls}>Review →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}

type PkgRow = Extract<Awaited<ReturnType<typeof listPackages>>, { ok: true }>["rows"][number];

function WeekendQueue({
  result, postable, counts,
}: {
  result: Awaited<ReturnType<typeof listPackages>>;
  postable: PkgRow[];
  counts: { review: number; needsPermission: number; privateMinor: number; posted: number };
}) {
  return (
    <div className="mb-6">
      <StatGrid>
        <StatCard label="Ready to post" value={postable.length} hint="approved-by-hicrete" />
        <StatCard label="Awaiting review" value={counts.review} hint="needs Hicrete" />
        <StatCard label="Needs permission" value={counts.needsPermission} hint="blocked" />
        <StatCard label="Private / minor" value={counts.privateMinor} hint="fail-closed" />
        <StatCard label="Posted" value={counts.posted} />
      </StatGrid>

      {!result.ok && result.missing && (
        <Callout tone="blue" title="Not set up yet — this is expected on preview">
          <p>The Phase B table <span className="font-mono">admin_content_packages</span> hasn&apos;t been created in this environment.</p>
        </Callout>
      )}
      {!result.ok && !result.missing && <Callout tone="red" title="Query error">{result.error}</Callout>}

      <Callout tone="neutral" title="Why some packages aren't here">
        <p className="text-xs">This queue shows only <span className="font-mono">approved-by-hicrete</span> + <span className="font-mono">approved-for-promo</span> + non-minor packages — the only ones cleared to post. Blocked items stay in the <Link href="/admin/content-packages" className="text-fuchsia-400 hover:underline">Review queue</Link>: needs-permission (no promo consent on record), private/minor (declined or minor recipient — fail-closed). Nothing here is posted automatically.</p>
      </Callout>

      {result.ok && postable.length === 0 && (
        <Callout tone="neutral" title="Nothing cleared to post yet">
          <p className="text-xs">Approve <span className="font-mono">approved-for-promo</span> packages in the <Link href="/admin/content-packages?status=pending-review" className="text-fuchsia-400 hover:underline">review queue</Link> to populate this list.</p>
        </Callout>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {postable.map((p) => {
          const s = suggestedContent(p);
          return (
            <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-neutral-100">{p.recipient_first_name ?? "—"}</div>
                  <div className="text-xs text-neutral-500">{[p.genre, p.language].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {mediaLinks(p)}
                  <Link href={`/admin/content-packages/${encodeURIComponent(p.share_id)}`} className={linkBtnCls}>Review →</Link>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["tiktok", "instagram", "youtube"] as const).map((k) => (
                  <div key={k}>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">{k}</div>
                    <textarea readOnly rows={6} className="w-full resize-y rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-[11px] text-neutral-300" value={s.captions[k]} />
                  </div>
                ))}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">More caption angles (reaction · gift · venue · pop-star vibe)</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {([
                    ["reaction / reveal", "reaction"],
                    ["birthday gift", "gift"],
                    ["venue / party", "venue"],
                    ["pop-star vibe (no endorsement)", "celebrity"],
                  ] as const).map(([label, vk]) => (
                    <div key={vk}>
                      <div className="mb-1 text-[10px] font-medium text-neutral-400">{label}</div>
                      <textarea readOnly rows={5} className="w-full resize-y rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-[11px] text-neutral-300" value={s.variants[vk]} />
                    </div>
                  ))}
                </div>
              </details>
              <div className="mt-2 text-xs text-neutral-500">Hashtags: <span className="font-mono text-neutral-400">{s.hashtags}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
