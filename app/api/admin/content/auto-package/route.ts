// Auto-package recent share_created songs into admin_content_packages.
//
// Auth: Vercel Cron header OR Authorization: Bearer $CRON_SECRET. With CRON_SECRET
// unset, only a genuine Vercel Cron invocation is accepted — never open to the public.
//
// Idempotent (skips already-packaged share_ids → preserves human edits), resumable,
// continues on per-share failure. Fail-closed permission buckets. NEVER approves,
// NEVER posts, NO destructive writes. `?dry=1` computes the plan without writing.

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { findShareCreatedCandidates, packageShareToAdmin, type Bucket } from "@/lib/content-packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearerOk = !!secret && auth === `Bearer ${secret}`;
  return isVercelCron || bearerOk;
}

async function handle(request: Request): Promise<Response> {
  if (!authorize(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  let supabase;
  try { supabase = getSupabaseAdmin(); } catch (e) {
    return Response.json({ error: "supabase not configured", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  let discovery;
  try {
    discovery = await findShareCreatedCandidates(supabase, {});
  } catch (e) {
    return Response.json({ error: "discovery_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  let packaged = 0, failed = 0;
  const buckets: Record<string, number> = {};
  const skipped: { share_id: string; reason: string }[] = [];

  for (const shareId of discovery.candidates) {
    try {
      const out = await packageShareToAdmin(supabase, shareId, { dry });
      if (out.action === "packaged") {
        packaged++;
        if (out.bucket) buckets[out.bucket] = (buckets[out.bucket as Bucket] || 0) + 1;
      } else if (out.action === "skipped") {
        skipped.push({ share_id: shareId, reason: out.reason ?? "skipped" });
      } else {
        failed++;
        skipped.push({ share_id: shareId, reason: out.reason ?? "failed" });
      }
    } catch (e) {
      failed++;
      skipped.push({ share_id: shareId, reason: e instanceof Error ? e.message : "error" });
    }
  }

  // Ops log (counts only — no PII / no share_ids) so cron runs are visible in logs.
  console.log(
    `[auto-package] dry=${dry} scanned=${discovery.scanned} already=${discovery.already_packaged} ` +
      `candidates=${discovery.candidates.length} packaged=${packaged} failed=${failed} buckets=${JSON.stringify(buckets)}`,
  );

  return Response.json({
    ok: true,
    dry,
    scanned: discovery.scanned,
    already_packaged: discovery.already_packaged,
    candidates: discovery.candidates.length,
    packaged,
    failed,
    buckets,
    skipped,
    note: "Never approves or posts. approved-for-promo lands as pending-review for Hicrete.",
  });
}

export async function GET(request: Request): Promise<Response> { return handle(request); }
export async function POST(request: Request): Promise<Response> { return handle(request); }
