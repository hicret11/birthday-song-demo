import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { loadSharedSong } from "@/lib/share";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Badge, Callout, Panel, inputCls, btnCls, linkBtnCls, fmtTs } from "../_ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://singmybirthday.com").replace(/\/+$/, "");

type PromoStatus = {
  bucket: "needs-permission" | "private-share-only" | "approved-for-promo";
  label: string; granted: boolean | null; minor: boolean | null;
  permission_text_version: string | null; policy_version: string | null;
};

async function resolvePromo(shareId: string): Promise<PromoStatus | { error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("promo_permissions")
      .select("granted,is_minor_recipient,permission_text_version,policy_version,created_at")
      .eq("share_id", shareId).order("created_at", { ascending: false }).limit(1);
    if (error) return { error: error.message };
    const row = data?.[0] as
      | { granted: boolean | null; is_minor_recipient: boolean | null; permission_text_version: string | null; policy_version: string | null }
      | undefined;
    if (!row) return { bucket: "needs-permission", label: "No permission record — do not post publicly.", granted: null, minor: null, permission_text_version: null, policy_version: null };
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-neutral-800/70 py-1.5 last:border-0">
      <div className="w-40 shrink-0 text-neutral-500">{label}</div>
      <div className="min-w-0 break-words text-neutral-200">{children}</div>
    </div>
  );
}

export default async function SharesPage({ searchParams }: { searchParams: Promise<{ share_id?: string }> }) {
  await requireAdmin();
  const { share_id } = await searchParams;

  const lookup = (
    <Panel title="Look up a share">
      <form method="GET" className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">Share ID<input type="text" name="share_id" defaultValue={share_id ?? ""} placeholder="e.g. 06WTV6e8" className={inputCls} /></label>
        <button type="submit" className={btnCls}>Look up</button>
      </form>
    </Panel>
  );

  if (!share_id) {
    return <div><h1 className="mb-4 text-xl font-semibold tracking-tight">Shares</h1>{lookup}<Callout tone="neutral">Enter a share ID, or click one from Events.</Callout></div>;
  }

  const song = await loadSharedSong(share_id);
  if (!song) {
    return <div><h1 className="mb-4 text-xl font-semibold tracking-tight">Shares</h1>{lookup}<Callout tone="amber" title="Not found">No share found for <span className="font-mono">{share_id}</span> (it may have expired — shares have a 90-day TTL).</Callout></div>;
  }

  const promo = await resolvePromo(share_id);
  const hasVideo = typeof song.videoUrl === "string" && song.videoUrl.length > 0;
  const sharePage = `${SITE}/share/${share_id}`;
  const tone = !("error" in promo) ? (promo.bucket === "approved-for-promo" ? "green" : promo.bucket === "needs-permission" ? "amber" : "red") : "red";
  const icon = !("error" in promo) ? (promo.bucket === "approved-for-promo" ? "✅" : promo.bucket === "needs-permission" ? "⚠️" : "🔒") : "⚠️";

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Shares</h1>
      {lookup}

      {/* Promo permission — visually obvious */}
      <div className="mb-4">
        {"error" in promo ? (
          <Callout tone="red" title="Permission query error">{promo.error}</Callout>
        ) : (
          <Callout tone={tone} title={<span>{icon} {promo.bucket}</span>}>
            <p>{promo.label}</p>
            <p className="text-xs opacity-80">granted={String(promo.granted)} · minor={String(promo.minor)} · text_v={promo.permission_text_version ?? "—"} · policy_v={promo.policy_version ?? "—"}</p>
          </Callout>
        )}
      </div>

      {/* Record card */}
      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-neutral-100">{song.name ?? "—"}</div>
          <span className="font-mono text-xs text-neutral-500">{share_id}</span>
        </div>
        <div className="text-xs">
          <Row label="genre / language">{[song.genre, song.language].filter(Boolean).join(" · ") || "—"}</Row>
          <Row label="template">{song.template ? <Badge tone="purple">{song.template}</Badge> : "—"}</Row>
          <Row label="created">{song.createdAt ? fmtTs(new Date(song.createdAt).toISOString()) : "—"}</Row>
          <Row label="media">{hasVideo ? "video + audio" : song.audioUrl ? "audio only" : "none"}</Row>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={sharePage} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Open share page</a>
          {hasVideo && <a href={song.videoUrl} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Open mp4</a>}
          {song.audioUrl && <a href={song.audioUrl} target="_blank" rel="noreferrer" className={linkBtnCls}>↗ Open audio</a>}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Preview</div>
        {hasVideo ? (
          <video controls preload="metadata" className="max-h-[460px] w-auto rounded-md border border-neutral-800" src={song.videoUrl} />
        ) : song.audioUrl ? (
          <audio controls preload="none" className="w-full" src={song.audioUrl} />
        ) : (
          <p className="text-neutral-500">No media available.</p>
        )}
      </div>
    </div>
  );
}
