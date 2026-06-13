import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { loadSharedSong } from "@/lib/share";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://singmybirthday.com").replace(/\/+$/, "");

type PromoStatus = {
  bucket: "needs-permission" | "private-share-only" | "approved-for-promo";
  label: string;
  granted: boolean | null;
  minor: boolean | null;
  permission_text_version: string | null;
  policy_version: string | null;
};

// Same fail-closed logic as the package-share CLI.
async function resolvePromo(shareId: string): Promise<PromoStatus | { error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("promo_permissions")
      .select("granted,is_minor_recipient,permission_text_version,policy_version,created_at")
      .eq("share_id", shareId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return { error: error.message };
    const row = data?.[0] as
      | { granted: boolean | null; is_minor_recipient: boolean | null; permission_text_version: string | null; policy_version: string | null }
      | undefined;
    if (!row) return { bucket: "needs-permission", label: "No permission record — DO NOT post publicly.", granted: null, minor: null, permission_text_version: null, policy_version: null };
    const minor = row.is_minor_recipient === true;
    const granted = row.granted === true;
    const base = { granted, minor, permission_text_version: row.permission_text_version ?? null, policy_version: row.policy_version ?? null };
    if (minor) return { ...base, bucket: "private-share-only", label: "Minor recipient — NOT for public promotion (share-only)." };
    if (granted) return { ...base, bucket: "approved-for-promo", label: "Approved for public promotion." };
    return { ...base, bucket: "private-share-only", label: "Permission declined — NOT for public promotion." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "promo query failed" };
  }
}

const BADGE: Record<string, string> = {
  "approved-for-promo": "border-green-700 bg-green-950 text-green-300",
  "private-share-only": "border-amber-700 bg-amber-950 text-amber-300",
  "needs-permission": "border-neutral-600 bg-neutral-800 text-neutral-300",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-neutral-900 py-1">
      <div className="w-40 shrink-0 text-neutral-500">{label}</div>
      <div className="break-all">{children}</div>
    </div>
  );
}

export default async function SharesPage({ searchParams }: { searchParams: Promise<{ share_id?: string }> }) {
  await requireAdmin();
  const { share_id } = await searchParams;

  const input = "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100";
  const lookup = (
    <form method="GET" className="mb-4 flex items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input type="text" name="share_id" defaultValue={share_id ?? ""} className={input} /></label>
      <button type="submit" className="rounded bg-fuchsia-600 px-3 py-1.5 font-semibold text-white hover:bg-fuchsia-500">Look up</button>
    </form>
  );

  if (!share_id) {
    return <div><h1 className="mb-3 text-base font-semibold">Shares <span className="text-neutral-500">(read-only)</span></h1>{lookup}<p className="text-neutral-500">Enter a share ID, or click one from Generations.</p></div>;
  }

  const song = await loadSharedSong(share_id);
  if (!song) {
    return <div><h1 className="mb-3 text-base font-semibold">Shares</h1>{lookup}<p className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2">No share found for <span className="font-mono">{share_id}</span> (may have expired — 90-day TTL).</p></div>;
  }

  const promo = await resolvePromo(share_id);
  const hasVideo = typeof song.videoUrl === "string" && song.videoUrl.length > 0;
  const sharePage = `${SITE}/share/${share_id}`;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-3 text-base font-semibold">Shares <span className="text-neutral-500">(read-only)</span></h1>
      {lookup}

      <div className="mb-4 rounded border border-neutral-800 p-3">
        <Field label="share_id"><span className="font-mono">{share_id}</span></Field>
        <Field label="recipient name">{song.name ?? "—"}</Field>
        <Field label="language">{song.language ?? "—"}</Field>
        <Field label="genre">{song.genre ?? "—"}</Field>
        <Field label="template">{song.template ?? "—"}</Field>
        <Field label="createdAt">{song.createdAt ? new Date(song.createdAt).toISOString() : "—"}</Field>
        <Field label="videoUrl">{hasVideo ? <a href={song.videoUrl} className="text-fuchsia-400 hover:underline" target="_blank" rel="noreferrer">open mp4</a> : "—"}</Field>
        <Field label="audioUrl">{song.audioUrl ? <a href={song.audioUrl} className="text-fuchsia-400 hover:underline" target="_blank" rel="noreferrer">open audio</a> : "—"}</Field>
        <Field label="share page"><a href={sharePage} className="text-fuchsia-400 hover:underline" target="_blank" rel="noreferrer">{sharePage}</a></Field>
      </div>

      <div className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-neutral-300">Promo permission</h2>
        {"error" in promo ? (
          <p className="rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">Permission query error: {promo.error}</p>
        ) : (
          <div className={`rounded border px-3 py-2 ${BADGE[promo.bucket]}`}>
            <div className="font-semibold">{promo.bucket}</div>
            <div className="text-xs opacity-90">{promo.label}</div>
            <div className="mt-1 text-xs opacity-70">granted={String(promo.granted)} · minor={String(promo.minor)} · text_v={promo.permission_text_version ?? "—"} · policy_v={promo.policy_version ?? "—"}</div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-300">Preview</h2>
        {hasVideo ? (
          <video controls preload="metadata" className="max-h-[480px] rounded border border-neutral-800" src={song.videoUrl} />
        ) : song.audioUrl ? (
          <audio controls preload="none" src={song.audioUrl} />
        ) : (
          <p className="text-neutral-500">No media.</p>
        )}
      </div>
    </div>
  );
}
