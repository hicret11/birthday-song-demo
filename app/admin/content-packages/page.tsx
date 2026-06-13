import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listPackages, PACKAGE_STATUSES, PERMISSION_BUCKETS } from "@/lib/admin-packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filters = { status?: string; permission_bucket?: string; share_id?: string };

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString().replace("T", " ").slice(0, 16);
}

export default async function ContentPackagesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requireAdmin();
  const sp = await searchParams;
  const result = await listPackages({ status: sp.status, permission_bucket: sp.permission_bucket, share_id: sp.share_id });

  const input = "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100";
  return (
    <div>
      <h1 className="mb-3 text-base font-semibold">Content Packages <span className="text-neutral-500">(Hicrete review)</span></h1>

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Status
          <select name="status" defaultValue={sp.status ?? ""} className={input}>
            <option value="">any</option>
            {PACKAGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Bucket
          <select name="permission_bucket" defaultValue={sp.permission_bucket ?? ""} className={input}>
            <option value="">any</option>
            {PERMISSION_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input type="text" name="share_id" defaultValue={sp.share_id ?? ""} className={input} /></label>
        <button type="submit" className="rounded bg-fuchsia-600 px-3 py-1.5 font-semibold text-white hover:bg-fuchsia-500">Filter</button>
        <Link href="/admin/content-packages" className="px-2 py-1.5 text-neutral-400 hover:underline">Reset</Link>
      </form>

      {!result.ok && result.missing && (
        <p className="rounded border border-amber-700 bg-amber-950 px-3 py-2 text-amber-300">{result.message}</p>
      )}
      {!result.ok && !result.missing && (
        <p className="rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">Query error: {result.error}</p>
      )}

      {result.ok && (
        <>
          <p className="mb-2 text-xs text-neutral-500">{result.rows.length} package(s).</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-400">
                  <th className="px-2 py-1">packaged_at</th><th className="px-2 py-1">recipient</th>
                  <th className="px-2 py-1">genre</th><th className="px-2 py-1">lang</th>
                  <th className="px-2 py-1">bucket</th><th className="px-2 py-1">status</th>
                  <th className="px-2 py-1">promo</th><th className="px-2 py-1">minor</th>
                  <th className="px-2 py-1">share_id</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-900 hover:bg-neutral-900">
                    <td className="whitespace-nowrap px-2 py-1 font-mono">{fmt(p.packaged_at ?? p.created_at)}</td>
                    <td className="px-2 py-1">{p.recipient_first_name ?? "—"}</td>
                    <td className="px-2 py-1">{p.genre ?? "—"}</td>
                    <td className="px-2 py-1">{p.language ?? "—"}</td>
                    <td className="px-2 py-1">{p.permission_bucket}</td>
                    <td className="px-2 py-1">{p.status}</td>
                    <td className="px-2 py-1">{p.promo_granted ? "✅" : "—"}</td>
                    <td className="px-2 py-1">{p.is_minor_recipient ? "⚠️" : "—"}</td>
                    <td className="px-2 py-1 font-mono">
                      <Link href={`/admin/content-packages/${encodeURIComponent(p.share_id)}`} className="text-fuchsia-400 hover:underline">{p.share_id}</Link>
                    </td>
                  </tr>
                ))}
                {result.rows.length === 0 && (
                  <tr><td colSpan={9} className="px-2 py-6 text-center text-neutral-500">No packages. Run the packager with <span className="font-mono">--record-admin</span>.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
