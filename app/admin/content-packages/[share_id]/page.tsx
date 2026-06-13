import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getPackageDetail, evaluateAction, type AdminAction } from "@/lib/admin-packages";
import { approveAction, declineAction, resetReviewAction, markPostedAction } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-neutral-900 py-1">
      <div className="w-44 shrink-0 text-neutral-500">{label}</div>
      <div className="break-all">{children}</div>
    </div>
  );
}

export default async function PackageDetailPage({
  params,
  searchParams,
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
    let msg = "";
    if ("missing" in result && result.missing) msg = result.message;
    else if ("notFound" in result && result.notFound) msg = `No package recorded for share_id ${share_id}. Run the packager with --record-admin.`;
    else if ("error" in result) msg = `Error: ${result.error}`;
    return <div>{back}<p className="mt-3 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-amber-300">{msg}</p></div>;
  }

  const { pkg, approvals } = result;
  const can = (a: AdminAction) => evaluateAction(pkg, a);
  const btn = (allowed: boolean) =>
    `rounded px-3 py-1.5 text-sm font-semibold ${allowed ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500" : "cursor-not-allowed border border-neutral-700 text-neutral-600"}`;

  const approve = can("approve"), decline = can("decline"), reset = can("reset-review"), markPosted = can("mark-posted");

  return (
    <div className="max-w-3xl">
      {back}
      <h1 className="mt-2 mb-3 text-base font-semibold">Package <span className="font-mono">{pkg.share_id}</span></h1>

      {ok && <p className="mb-3 rounded border border-green-800 bg-green-950 px-3 py-2 text-green-300">Status updated → <span className="font-mono">{ok}</span></p>}
      {err && <p className="mb-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">{err}</p>}

      <div className="mb-4 rounded border border-neutral-800 p-3">
        <Field label="status"><span className="font-mono">{pkg.status}</span></Field>
        <Field label="permission_bucket">{pkg.permission_bucket}</Field>
        <Field label="promo_granted">{String(pkg.promo_granted)}</Field>
        <Field label="is_minor_recipient">{String(pkg.is_minor_recipient)}</Field>
        <Field label="recipient_first_name">{pkg.recipient_first_name ?? "—"}</Field>
        <Field label="genre / language / template">{[pkg.genre, pkg.language, pkg.template].map((x) => x ?? "—").join(" · ")}</Field>
        <Field label="permission versions">text={pkg.permission_text_version ?? "—"} · policy={pkg.policy_version ?? "—"}</Field>
        <Field label="video_url">{pkg.video_url ? <a className="text-fuchsia-400 hover:underline" href={pkg.video_url} target="_blank" rel="noreferrer">open mp4</a> : "—"}</Field>
        <Field label="audio_url">{pkg.audio_url ? <a className="text-fuchsia-400 hover:underline" href={pkg.audio_url} target="_blank" rel="noreferrer">open audio</a> : "—"}</Field>
        <Field label="thumbnail_url">{pkg.thumbnail_url ? <a className="text-fuchsia-400 hover:underline" href={pkg.thumbnail_url} target="_blank" rel="noreferrer">open</a> : "— (local-only)"}</Field>
        <Field label="share_page_url">{pkg.share_page_url ? <a className="text-fuchsia-400 hover:underline" href={pkg.share_page_url} target="_blank" rel="noreferrer">{pkg.share_page_url}</a> : "—"}</Field>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Actions</h2>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <form action={approveAction.bind(null, pkg.share_id)}>
          <button type="submit" disabled={!approve.allowed} title={approve.allowed ? "" : approve.reason} className={btn(approve.allowed)}>Approve</button>
        </form>
        <form action={markPostedAction.bind(null, pkg.share_id)}>
          <button type="submit" disabled={!markPosted.allowed} title={markPosted.allowed ? "" : markPosted.reason} className={btn(markPosted.allowed)}>Mark posted</button>
        </form>
        <form action={declineAction.bind(null, pkg.share_id)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">note (optional)<input name="note" type="text" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" /></label>
          <button type="submit" disabled={!decline.allowed} title={decline.allowed ? "" : decline.reason} className={btn(decline.allowed)}>Decline</button>
        </form>
        <form action={resetReviewAction.bind(null, pkg.share_id)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">note (optional)<input name="note" type="text" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100" /></label>
          <button type="submit" disabled={!reset.allowed} title={reset.allowed ? "" : reset.reason} className={btn(reset.allowed)}>Reset review</button>
        </form>
      </div>
      <p className="mb-5 text-xs text-neutral-500">
        Approve requires <span className="font-mono">permission_bucket=approved-for-promo</span>, <span className="font-mono">promo_granted=true</span>, <span className="font-mono">is_minor_recipient=false</span>. Rules are re-checked server-side.
      </p>

      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Approval history</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead><tr className="border-b border-neutral-700 text-left text-neutral-400"><th className="px-2 py-1">when</th><th className="px-2 py-1">action</th><th className="px-2 py-1">actor</th><th className="px-2 py-1">note</th></tr></thead>
          <tbody>
            {approvals.map((a) => (
              <tr key={a.id} className="border-b border-neutral-900">
                <td className="whitespace-nowrap px-2 py-1 font-mono">{new Date(a.created_at).toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="px-2 py-1">{a.action}</td>
                <td className="px-2 py-1">{a.actor ?? "—"}</td>
                <td className="px-2 py-1">{a.note ?? "—"}</td>
              </tr>
            ))}
            {approvals.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-neutral-500">No actions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
