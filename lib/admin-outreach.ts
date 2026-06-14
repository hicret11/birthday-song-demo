// Server-only data layer for UAE outreach leads (admin_outreach_leads).
// Reads/writes via the service role. No next/headers import, so it is safe to
// import from the CLI as well as Server Components. Never scrapes anything.

import { getSupabaseAdmin } from "./supabase-admin";
import { OUTREACH_STATUSES, type NormalizedLead, type OutreachStatus } from "./outreach/provider";
import type { EmailTemplate } from "./outreach/email";

export type OutreachLead = {
  id: string;
  source: string;
  source_place_id: string | null;
  business_name: string;
  category: string | null;
  country: string;
  city: string | null;
  area: string | null;
  address: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  rating: number | null;
  review_count: number | null;
  relevance_score: number | null;
  outreach_status: string;
  owner: string | null;
  notes: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const COLS =
  "id,source,source_place_id,business_name,category,country,city,area,address,website_url,phone,email,instagram_url,google_maps_url,rating,review_count,relevance_score,outreach_status,owner,notes,last_seen_at,created_at,updated_at";

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" ||
    /could not find the table|schema cache|does not exist/i.test(error.message || "");
}

export type ListFilters = { city?: string; category?: string; status?: string; minRating?: string; q?: string };
export type ListResult =
  | { ok: true; rows: OutreachLead[] }
  | { ok: false; missing: true; message: string }
  | { ok: false; missing: false; error: string };

const MISSING = "Outreach table not applied yet (Phase C migration). Empty/unavailable is expected until merge.";

export async function listLeads(f: ListFilters): Promise<ListResult> {
  try {
    const supabase = getSupabaseAdmin();
    let q = supabase.from("admin_outreach_leads").select(COLS);
    if (f.city) q = q.ilike("city", `%${f.city}%`);
    if (f.category) q = q.ilike("category", `%${f.category}%`);
    if (f.status) q = q.eq("outreach_status", f.status);
    if (f.minRating && !Number.isNaN(Number(f.minRating))) q = q.gte("rating", Number(f.minRating));
    if (f.q) q = q.ilike("business_name", `%${f.q}%`);
    const { data, error } = await q.order("relevance_score", { ascending: false, nullsFirst: false })
      .order("last_seen_at", { ascending: false }).limit(200);
    if (error) return isMissingTableError(error) ? { ok: false, missing: true, message: MISSING } : { ok: false, missing: false, error: error.message };
    return { ok: true, rows: (data ?? []) as OutreachLead[] };
  } catch (e) {
    return { ok: false, missing: false, error: e instanceof Error ? e.message : "query failed" };
  }
}

export async function updateLead(
  id: string,
  patch: { outreach_status?: string; owner?: string | null; notes?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (patch.outreach_status && !(OUTREACH_STATUSES as readonly string[]).includes(patch.outreach_status)) {
    return { ok: false, error: `invalid status "${patch.outreach_status}"` };
  }
  try {
    const supabase = getSupabaseAdmin();
    const upd: Record<string, unknown> = {};
    if (patch.outreach_status) upd.outreach_status = patch.outreach_status as OutreachStatus;
    if (patch.owner !== undefined) upd.owner = patch.owner || null;
    if (patch.notes !== undefined) upd.notes = patch.notes || null;
    if (Object.keys(upd).length === 0) return { ok: true };
    const { error } = await supabase.from("admin_outreach_leads").update(upd).eq("id", id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "update failed" };
  }
}

// ── Lead detail ─────────────────────────────────────────────────────────────
export type LeadResult =
  | { ok: true; lead: OutreachLead }
  | { ok: false; missing: true; message: string }
  | { ok: false; notFound: true }
  | { ok: false; missing: false; error: string };

export async function getLead(id: string): Promise<LeadResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("admin_outreach_leads").select(COLS).eq("id", id).limit(1);
    if (error) return isMissingTableError(error) ? { ok: false, missing: true, message: MISSING } : { ok: false, missing: false, error: error.message };
    const lead = data?.[0] as OutreachLead | undefined;
    return lead ? { ok: true, lead } : { ok: false, notFound: true };
  } catch (e) {
    return { ok: false, missing: false, error: e instanceof Error ? e.message : "query failed" };
  }
}

// ── Email templates ─────────────────────────────────────────────────────────
export async function listTemplates(): Promise<EmailTemplate[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("outreach_email_templates")
      .select("template_key,name,category_hint,subject,body")
      .eq("is_active", true).order("name", { ascending: true });
    if (error) return [];
    return (data ?? []) as EmailTemplate[];
  } catch { return []; }
}

// ── Activity / history (append-only) ────────────────────────────────────────
export type ActivityRow = { id: string; action: string; template_key: string | null; channel: string; note: string | null; actor: string | null; created_at: string };

export async function logActivity(input: { leadId: string; action: string; template_key?: string | null; note?: string | null; actor?: string | null }): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("outreach_activity").insert({
      lead_id: input.leadId, action: input.action,
      template_key: input.template_key || null, note: input.note || null,
      actor: input.actor || "admin", channel: "email",
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "insert failed" }; }
}

export async function listActivity(leadId: string): Promise<ActivityRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("outreach_activity")
      .select("id,action,template_key,channel,note,actor,created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(100);
    if (error) return [];
    return (data ?? []) as ActivityRow[];
  } catch { return []; }
}

/** Count distinct leads that have a 'drafted' activity (for the "Drafted" card). */
export async function countDraftedLeads(): Promise<number | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("outreach_activity").select("lead_id").eq("action", "drafted").limit(2000);
    if (error) return null;
    return new Set((data ?? []).map((r) => (r as { lead_id: string }).lead_id)).size;
  } catch { return null; }
}

/** One promo-approved share page URL to use as a public sample link, if any. */
export async function getSampleShareLink(): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_content_packages")
      .select("share_page_url")
      .eq("permission_bucket", "approved-for-promo")
      .not("share_page_url", "is", null)
      .order("packaged_at", { ascending: false }).limit(1);
    if (error) return null;
    return (data?.[0] as { share_page_url: string | null } | undefined)?.share_page_url ?? null;
  } catch { return null; }
}

export type UpsertResult = {
  inserted: number; updated: number; skipped: number; missing?: boolean; error?: string;
  details: { business_name: string; action: "insert" | "update" | "skip" }[];
};

/**
 * Dedup-aware upsert of normalized leads. Refreshes business fields + last_seen_at
 * on existing rows but PRESERVES human-edited outreach_status/owner/notes.
 * dry=true computes the plan without writing.
 */
export async function upsertLeads(leads: NormalizedLead[], opts: { dry?: boolean } = {}): Promise<UpsertResult> {
  const res: UpsertResult = { inserted: 0, updated: 0, skipped: 0, details: [] };
  let supabase;
  try { supabase = getSupabaseAdmin(); } catch (e) { return { ...res, error: e instanceof Error ? e.message : "no supabase" }; }

  for (const lead of leads) {
    // Find existing by dedup key.
    let existingId: string | null = null;
    try {
      let find = supabase.from("admin_outreach_leads").select("id").limit(1);
      if (lead.source_place_id) {
        find = find.eq("source", lead.source).eq("source_place_id", lead.source_place_id);
      } else {
        find = find.ilike("business_name", lead.business_name);
        find = lead.city ? find.eq("city", lead.city) : find.is("city", null);
      }
      const { data, error } = await find;
      if (error) {
        if (isMissingTableError(error)) return { ...res, missing: true, error: MISSING };
        res.skipped++; res.details.push({ business_name: lead.business_name, action: "skip" }); continue;
      }
      existingId = data?.[0]?.id ?? null;
    } catch {
      res.skipped++; res.details.push({ business_name: lead.business_name, action: "skip" }); continue;
    }

    const businessFields = {
      source: lead.source, source_place_id: lead.source_place_id, business_name: lead.business_name,
      category: lead.category, country: lead.country, city: lead.city, area: lead.area, address: lead.address,
      website_url: lead.website_url, phone: lead.phone, email: lead.email, instagram_url: lead.instagram_url,
      google_maps_url: lead.google_maps_url, rating: lead.rating, review_count: lead.review_count,
      relevance_score: lead.relevance_score, last_seen_at: new Date().toISOString(),
    };

    if (existingId) {
      if (!opts.dry) {
        // NOTE: deliberately not touching outreach_status / owner / notes.
        const { error } = await supabase.from("admin_outreach_leads").update(businessFields).eq("id", existingId);
        if (error) { res.skipped++; res.details.push({ business_name: lead.business_name, action: "skip" }); continue; }
      }
      res.updated++; res.details.push({ business_name: lead.business_name, action: "update" });
    } else {
      if (!opts.dry) {
        const { error } = await supabase.from("admin_outreach_leads").insert({ ...businessFields, outreach_status: "new" });
        if (error) { res.skipped++; res.details.push({ business_name: lead.business_name, action: "skip" }); continue; }
      }
      res.inserted++; res.details.push({ business_name: lead.business_name, action: "insert" });
    }
  }
  return res;
}
