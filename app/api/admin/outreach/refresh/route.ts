// Protected outreach refresh — discovers UAE venue leads via the configured
// provider (Google Places, env-gated) and upserts into admin_outreach_leads.
//
// Auth: Vercel Cron (x-vercel-cron header, platform-set, not forwardable) OR
// Authorization: Bearer $CRON_SECRET. With CRON_SECRET unset, only a genuine
// Vercel Cron is accepted — never open to the public.
//
// Skips (no cost, no crash) when OUTREACH_PROVIDER != google_places or the API
// key is missing. NEVER scrapes, NEVER sends email, NEVER auto-contacts. Returns
// counts only — no personal data logged. `?dry=1` fetches but writes nothing.

import { fetchUaeVenueLeads, getProviderName } from "@/lib/outreach/provider";
import { upsertLeads } from "@/lib/admin-outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // discovery loops over cities×queries

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

  let provider;
  try {
    provider = await fetchUaeVenueLeads();
  } catch {
    // Never crash production on provider/API errors.
    console.warn("[outreach-refresh] provider error (failing soft)");
    return Response.json({ ok: false, skipped: true, reason: "provider error", inserted: 0, updated: 0 }, { status: 200 });
  }

  if (!provider.configured) {
    return Response.json({ ok: true, skipped: true, reason: provider.reason, inserted: 0, updated: 0 });
  }

  let result;
  try {
    result = await upsertLeads(provider.leads, { dry });
  } catch {
    console.warn("[outreach-refresh] upsert error (failing soft)");
    return Response.json({ ok: false, error: "upsert failed", inserted: 0, updated: 0 }, { status: 200 });
  }
  if (result.missing) {
    return Response.json({ ok: true, skipped: true, reason: "admin_outreach_leads not applied", inserted: 0, updated: 0 });
  }

  // Counts/stats only — no business/personal data in logs.
  console.log(
    `[outreach-refresh] dry=${dry} provider=${getProviderName()} fetched=${provider.leads.length} ` +
      `inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped} stats=${JSON.stringify(provider.stats ?? {})}`,
  );

  return Response.json({
    ok: true,
    dry,
    provider: getProviderName(),
    fetched: provider.leads.length,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    stats: provider.stats ?? null,
  });
}

export async function GET(request: Request): Promise<Response> { return handle(request); }
export async function POST(request: Request): Promise<Response> { return handle(request); }
