// Protected outreach refresh endpoint (Phase C1 = stub; no real fetch, no scraping).
//
// Auth: Vercel Cron (x-vercel-cron header, set by the platform and not forwardable
// from external callers) OR Authorization: Bearer $CRON_SECRET. If CRON_SECRET is
// unset, only a genuine Vercel Cron invocation is accepted — the endpoint is never
// open to the public.
//
// With the provider "none" (default), returns { skipped: true } and writes nothing.

import { fetchUaeVenueLeads } from "@/lib/outreach/provider";

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
  if (!authorize(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const provider = await fetchUaeVenueLeads();
  if (!provider.configured) {
    return Response.json({ skipped: true, reason: provider.reason, inserted: 0, updated: 0 });
  }
  // Phase C2: upsertLeads(provider.leads) here. Not reachable in C1.
  return Response.json({ skipped: true, reason: "no-op in C1", inserted: 0, updated: 0 });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
