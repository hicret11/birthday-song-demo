import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getPackageDetail, evaluateAction, type AdminAction, type PackageRow } from "@/lib/admin-packages";
import { suggestedContent } from "@/lib/content-packages";
import { SOCIAL_PLATFORMS } from "@/lib/admin-social";
import { approveAction, declineAction, resetReviewAction, markPostedAction, createPlannedPostAction } from "../actions";
import { Badge, BucketBadge, Callout, StatusBadge, linkBtnCls, inputCls, fmtTs } from "../../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-neutral-800/70 py-1.5 last:border-0">
      <div className="w-40 shrink-0 text-neutral-500">{label}</div>
      <div className="min-w-0 break-words text-neutral-200">{children}</div>
    </div>
  );
}

// Primary state banner derived from status + bucket.
function banner(pkg: PackageRow): { tone: "amber" | "green" | "red" | "blue"; icon: string; text: string } {
  if (pkg.status === "posted") return { tone: "blue", icon: "📣", text: "Posted." };
  if (pkg.status === "approved-by-hicrete") return { tone: "green", icon: "✅", text: "Approved by Hicrete — ready to post. Use “Mark posted” once it’s live." };
  if (pkg.status === "declined-by-hicrete") return { tone: "red", icon: "🚫", text: "Declined — not for posting. You can Reset review to reconsider." };
  if (pkg.is_minor_recipient) return { tone: "red", icon: "🔒", text: "Minor recipient — fail-closed. Cannot be posted publicly." };
  if (pkg.permission_bucket === "private-share-only") return { tone: "red", icon: "🔒", text: "Private / permission declined — cannot be posted publicly." };
  if (pkg.permission_bucket === "needs-permission") return { tone: "amber", icon: "⚠️", text: "Needs permission — no promo permission on record. Cannot post publicly." };
  if (pkg.permission_bucket === "approved-for-promo") return { tone: "amber", icon: "🟡", text: "Pending review — Approve or Decline for posting." };
  return { tone: "amber", icon: "•", text: pkg.status };
}

export default async function PackageDetailPage({
  params, searchParams,
}: {
  params: Promise<{ share_id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { share_id } = await params;
  const { ok, err } = await searchParams;
  const result = await getPackageDetail(share_id);

  const back = <Link href="/admin/content-packages" className="text-fuchsia-400 hover:underline">← all packages</Link>;

  if (!result.ok) {
    let msg = "", tone: "amber" | "blue" = "amber";
    if ("missing" in result && result.missing) { msg = result.message; tone = "blue"; }
    else if ("notFound" in result && result.notFound) msg = `No package recorded for share_id ${share_id}. Run the packager with --record-admin.`;
    else if ("error" in result) msg = `Error: ${result.error}`;
    return <div>{back}<div className="mt-3"><Callout tone={tone}>{msg}</Callout></div></div>;
  }

  const { pkg, approvals } = result;
  const can = (a: AdminAction) => evaluateAction(pkg, a);
  const approve = can("approve"), decline = can("decline"), reset = can("reset-review"), markPosted = can("mark-posted");
  const b = banner(pkg);
  const btn = (allowed: boolean) =>
    `rounded px-3 py-1.5 text-sm font-semibold ${allowed ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500" : "cursor-not-allowed border border-neutral-700 text-neutral-600"}`;

  return (
    <div className="max-w-3xl">
      {back}
      <div className="mt-2 mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{pkg.recipient_first_name ?? "Package"} <span className="ml-1 font-mono text-sm text-neutral-500">{pkg.share_id}</span></h1>
        <span className="flex gap-1"><StatusBadge status={pkg.status} /></span>
      </div>

      {ok && <div className="mb-3"><Callout tone="green">Status updated → <span className="font-mono">{ok}</span></Callout></div>}
      {err && <div className="mb-3"><Callout tone="red">{err}</Callout></div>}

      {/* Primary state banner */}
      <div className="mb-4"><Callout tone={b.tone} title={<span>{b.icon} {pkg.permission_bucket}</span>}>{b.text}</Callout></div>

      {/* Record card */}
      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-xs">
        <Field label="status"><StatusBadge status={pkg.status} /></Field>
        <Field label="permission bucket"><BucketBadge bucket={pkg.permission_bucket} /></Field>
        <Field label="promo_granted">{pkg.promo_granted ? <Badge tone="green">true</Badge> : <Badge tone="neutral">false</Badge>}</Field>
        <Field label="is_minor_recipient">{pkg.is_minor_recipient ? <Badge tone="red">true</Badge> : <Badge tone="neutral">false</Badge>}</Field>
        <Field label="recipient">{pkg.recipient_first_name ?? "—"}</Field>
        <Field label="genre / language / template">{[pkg.genre, pkg.language, pkg.template].map((x) => x ?? "—").join(" · ")}</Field>
        <Field label="permission versions">text={pkg.permission_text_version ?? "—"} · policy={pkg.policy_version ?? "—"}</Field>
        <Field label="packaged">{fmtTs(pkg.packaged_at ?? pkg.created_at)}</Field>
      </div>

      {/* Media / links */}
      <div className="mb-4 flex flex-wrap gap-2">
        {pkg.share_page_url && <a href={pkg.share_page_url} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Open share page</a>}
        {pkg.video_url && <a href={pkg.video_url} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Open mp4</a>}
        {pkg.audio_url && <a href={pkg.audio_url} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Open audio</a>}
        {pkg.thumbnail_url && <a href={pkg.thumbnail_url} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Thumbnail</a>}
        {!pkg.share_page_url && !pkg.video_url && !pkg.audio_url && <span className="text-xs text-neutral-600">No media links recorded.</span>}
      </div>

      {/* Actions */}
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Review actions</h2>
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <form action={approveAction.bind(null, pkg.share_id)}>
          <button type="submit" disabled={!approve.allowed} title={approve.allowed ? "" : approve.reason} className={btn(approve.allowed)}>Approve</button>
        </form>
        <form action={markPostedAction.bind(null, pkg.share_id)}>
          <button type="submit" disabled={!markPosted.allowed} title={markPosted.allowed ? "" : markPosted.reason} className={btn(markPosted.allowed)}>Mark posted</button>
        </form>
        <form action={declineAction.bind(null, pkg.share_id)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">note (optional)<input name="note" type="text" className={inputCls} /></label>
          <button type="submit" disabled={!decline.allowed} title={decline.allowed ? "" : decline.reason} className={btn(decline.allowed)}>Decline</button>
        </form>
        <form action={resetReviewAction.bind(null, pkg.share_id)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">note (optional)<input name="note" type="text" className={inputCls} /></label>
          <button type="submit" disabled={!reset.allowed} title={reset.allowed ? "" : reset.reason} className={btn(reset.allowed)}>Reset review</button>
        </form>
      </div>
      <p className="mb-5 text-xs text-neutral-500">Approve requires <span className="font-mono">approved-for-promo</span> + <span className="font-mono">promo_granted=true</span> + <span className="font-mono">is_minor_recipient=false</span>. Disabled buttons show why on hover; rules are re-checked server-side (fail-closed).</p>

      {/* Suggested content (derived, not stored) */}
      {(() => {
        const s = suggestedContent(pkg);
        const isApproved = pkg.status === "approved-by-hicrete";
        return (
          <div className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-neutral-300">Suggested content <span className="font-normal text-neutral-500">(auto-generated; copy & post manually)</span></h2>
            <div className="grid gap-3 md:grid-cols-3">
              {(["tiktok", "instagram", "youtube"] as const).map((k) => (
                <div key={k} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{k}</div>
                  <textarea readOnly rows={7} className="w-full resize-y rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-[11px] text-neutral-300" value={s.captions[k]} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">caption angles</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["reaction / reveal clip", "reaction"],
                  ["birthday song gift", "gift"],
                  ["venue / party use", "venue"],
                  ["pop-star vibe (no endorsement)", "celebrity"],
                ] as const).map(([label, k]) => (
                  <div key={k} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-2">
                    <div className="mb-1 text-[11px] font-medium text-neutral-400">{label}</div>
                    <textarea readOnly rows={6} className="w-full resize-y rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-[11px] text-neutral-300" value={s.variants[k]} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              Share link: <a href={s.share_link} target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">{s.share_link}</a>
            </div>
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Create planned social post</h3>
              {isApproved ? (
                <form action={createPlannedPostAction.bind(null, pkg.share_id)} className="flex items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-neutral-400">Platform
                    <select name="platform" defaultValue="tiktok" className={inputCls}>
                      {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <button type="submit" className="rounded bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-500">Add planned post</button>
                  <span className="text-xs text-neutral-500">→ writes a <span className="font-mono">planned</span> row in Social; posts nothing.</span>
                </form>
              ) : (
                <p className="text-xs text-neutral-500">Available once the package is <span className="font-mono">approved-by-hicrete</span>.</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* History */}
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Approval history</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full border-collapse text-xs">
          <thead><tr className="border-b border-neutral-800 text-left text-neutral-400"><th className="px-3 py-2">when</th><th className="px-3 py-2">action</th><th className="px-3 py-2">actor</th><th className="px-3 py-2">note</th></tr></thead>
          <tbody>
            {approvals.map((a) => (
              <tr key={a.id} className="border-b border-neutral-900">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-400">{fmtTs(a.created_at)}</td>
                <td className="px-3 py-1.5">{a.action}</td>
                <td className="px-3 py-1.5">{a.actor ?? "—"}</td>
                <td className="px-3 py-1.5 text-neutral-300">{a.note ?? "—"}</td>
              </tr>
            ))}
            {approvals.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-500">No actions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
