/**
 * Privacy export + deletion-plan tooling (internal, CLI-only — no public UI).
 *
 * Collects all user-related records across the current data stores keyed by
 * email (and optionally anonymous_id / share_id), writes a structured JSON
 * export to `privacy-exports/`, and can produce a DRY-RUN deletion plan.
 *
 * Hard delete is intentionally NOT implemented in this phase (see --confirm-delete).
 *
 * Usage:
 *   npx tsx scripts/privacy/export-user-data.ts --email=foo@bar.com
 *   npx tsx scripts/privacy/export-user-data.ts --email=foo@bar.com --anonymous-id=anon_x --share-id=abc123
 *   npx tsx scripts/privacy/export-user-data.ts --email=foo@bar.com --mode=plan-delete
 *
 * Or via package scripts:
 *   npm run privacy:export      -- --email=foo@bar.com
 *   npm run privacy:plan-delete -- --email=foo@bar.com
 *
 * Stores covered:
 *   Supabase: waitlist_leads, venues, legal_acceptance, cookie_consent_log,
 *             generation_events, promo_permissions, raffle_entries
 *   Vercel KV: share:{id} (only for share ids we can discover — see README)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// ── Load env (service keys etc.) the same way the other scripts do, WITHOUT
//    overwriting anything already set, and WITHOUT ever printing values. ──
for (const file of [".env.production.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// These read env lazily (on first call), so importing before env-load is fine.
import { getSupabaseAdmin } from "../../lib/supabase-admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "export" | "plan-delete";

type CliArgs = {
  email: string;
  anonymousId: string | null;
  shareId: string | null;
  mode: Mode;
  confirmDelete: boolean;
};

type StoreResult = {
  store: string;
  count: number;
  rows: Record<string, unknown>[];
};

type ExportError = { store: string; message: string };

function parseArgs(argv: string[]): CliArgs | { error: string } {
  const get = (name: string): string | null => {
    const prefix = `--${name}=`;
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length).trim() : null;
  };

  const email = (get("email") ?? "").toLowerCase();
  if (!email) return { error: "Missing required --email." };
  if (!EMAIL_RE.test(email)) return { error: `Invalid email format: ${email}` };

  const modeRaw = get("mode") ?? "export";
  if (modeRaw !== "export" && modeRaw !== "plan-delete") {
    return { error: `Invalid --mode: ${modeRaw} (expected "export" or "plan-delete").` };
  }

  const sanitizeId = (v: string | null): string | null => {
    if (!v) return null;
    const t = v.trim().slice(0, 128);
    return t || null;
  };

  return {
    email,
    anonymousId: sanitizeId(get("anonymous-id")),
    shareId: sanitizeId(get("share-id")),
    mode: modeRaw,
    confirmDelete: argv.includes("--confirm-delete"),
  };
}

// Build a PostgREST `.or()` filter from the available join keys for a store.
function orFilter(parts: Array<[column: string, value: string | null]>): string {
  return parts
    .filter(([, v]) => v !== null && v !== "")
    .map(([col, v]) => `${col}.eq.${v}`)
    .join(",");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(`✖ ${parsed.error}`);
    console.error("  Usage: npx tsx scripts/privacy/export-user-data.ts --email=<email> [--anonymous-id=] [--share-id=] [--mode=export|plan-delete]");
    process.exit(1);
    return;
  }
  const { email, anonymousId, shareId, mode, confirmDelete } = parsed;

  if (confirmDelete) {
    // Safety: hard delete is intentionally not implemented in this phase.
    console.error("✖ --confirm-delete is not supported: hard deletion is intentionally NOT implemented in this phase.");
    console.error("  Run with --mode=plan-delete to produce a dry-run deletion plan instead.");
    process.exit(2);
    return;
  }

  const errors: ExportError[] = [];
  const stores: Record<string, StoreResult> = {};

  let supabase: ReturnType<typeof getSupabaseAdmin> | null = null;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    errors.push({ store: "supabase", message: `Supabase admin unavailable: ${errMsg(err)}` });
  }

  // Helper: run one store query, capturing failures into `errors` instead of
  // crashing the whole export.
  async function collect(
    storeName: string,
    run: () => Promise<Record<string, unknown>[]>,
  ): Promise<void> {
    if (!supabase) {
      stores[storeName] = { store: storeName, count: 0, rows: [] };
      return;
    }
    try {
      const rows = await run();
      stores[storeName] = { store: storeName, count: rows.length, rows };
    } catch (err) {
      stores[storeName] = { store: storeName, count: 0, rows: [] };
      errors.push({ store: storeName, message: errMsg(err) });
    }
  }

  const sb = () => supabase!;

  // ── Email-only stores ────────────────────────────────────────────────────
  await collect("waitlist_leads", async () => {
    const { data, error } = await sb().from("waitlist_leads").select("*").ilike("email", email);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  await collect("venues", async () => {
    const { data, error } = await sb().from("venues").select("*").ilike("email", email);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  await collect("legal_acceptance", async () => {
    const { data, error } = await sb().from("legal_acceptance").select("*").ilike("email", email);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  // ── cookie_consent_log: no email column. Keyed by user_id (== email when set)
  //    and anonymous_id (provide --anonymous-id for discovery). ──
  await collect("cookie_consent_log", async () => {
    const filter = orFilter([
      ["user_id", email],
      ["anonymous_id", anonymousId],
    ]);
    const { data, error } = await sb().from("cookie_consent_log").select("*").or(filter);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  // ── Multi-key stores: email OR anonymous_id OR share_id ───────────────────
  await collect("generation_events", async () => {
    const filter = orFilter([
      ["email", email],
      ["anonymous_id", anonymousId],
      ["share_id", shareId],
    ]);
    const { data, error } = await sb().from("generation_events").select("*").or(filter);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  await collect("promo_permissions", async () => {
    const filter = orFilter([
      ["email", email],
      ["anonymous_id", anonymousId],
      ["share_id", shareId],
    ]);
    const { data, error } = await sb().from("promo_permissions").select("*").or(filter);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  await collect("raffle_entries", async () => {
    const filter = orFilter([
      ["email", email],
      ["anonymous_id", anonymousId],
    ]);
    const { data, error } = await sb().from("raffle_entries").select("*").or(filter);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

  // ── Vercel KV shares ───────────────────────────────────────────────────────
  // KV cannot be scanned by email. Discover share ids from the explicit
  // --share-id and from any share_id surfaced in the Supabase results above.
  const discoveredShareIds = new Set<string>();
  if (shareId) discoveredShareIds.add(shareId);
  for (const storeName of ["generation_events", "promo_permissions"]) {
    for (const row of stores[storeName]?.rows ?? []) {
      const sid = row["share_id"];
      if (typeof sid === "string" && sid) discoveredShareIds.add(sid);
    }
  }

  const kvItems: Array<{ share_id: string; found: boolean; value: unknown }> = [];
  if (discoveredShareIds.size > 0) {
    try {
      const { kv } = await import("@vercel/kv");
      for (const sid of discoveredShareIds) {
        try {
          const value = await kv.get(`share:${sid}`);
          kvItems.push({ share_id: sid, found: value != null, value: value ?? null });
        } catch (err) {
          errors.push({ store: `kv:share:${sid}`, message: errMsg(err) });
        }
      }
    } catch (err) {
      errors.push({ store: "kv", message: `KV unavailable: ${errMsg(err)}` });
    }
  }

  const notes: string[] = [
    "There is no stable user_id. Email, anonymous_id, and share_id are the join keys.",
    "cookie_consent_log has no email column — rows are matched by anonymous_id (or user_id if ever set). Pass --anonymous-id to discover them.",
    "Vercel KV cannot be searched globally; only share ids discoverable from the inputs/Supabase rows are included. Older shares without a linking row require the requester to supply the share URL/id. KV shares also expire ~90 days (TTL).",
    "venues rows carry Stripe billing linkage — review/retention rules apply before deletion.",
  ];

  const output: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    mode,
    query: { email, anonymous_id: anonymousId, share_id: shareId },
    stores,
    kv_shares: { count: kvItems.length, share_ids: [...discoveredShareIds], items: kvItems },
    errors,
    notes,
  };

  if (mode === "plan-delete") {
    output.delete_plan = buildDeletePlan(stores, kvItems);
    output.hard_delete = {
      executed: false,
      reason: "Dry-run only. Hard delete is intentionally not implemented in this phase.",
    };
  }

  // ── Write to a safe local path. Never dump full PII to stdout. ──
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const emailSafe = email.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
  const dir = path.join(process.cwd(), "privacy-exports");
  await mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${ts}-${emailSafe}.json`);
  await writeFile(outPath, JSON.stringify(output, null, 2), "utf8");

  // Summary only — counts, not PII.
  console.log(`✓ ${mode} complete for <email redacted>`);
  for (const [name, res] of Object.entries(stores)) {
    console.log(`  ${name.padEnd(20)} ${res.count} row(s)`);
  }
  console.log(`  ${"kv_shares".padEnd(20)} ${kvItems.length} share(s)`);
  if (errors.length > 0) {
    console.log(`  ⚠ ${errors.length} store error(s) — see "errors" in the output file (stores: ${errors.map((e) => e.store).join(", ")})`);
  }
  console.log(`  → ${path.relative(process.cwd(), outPath)}`);
}

type DeletePlanEntry = {
  table: string;
  strategy: "delete" | "anonymize" | "review";
  would_affect_ids: string[];
  note?: string;
};

function buildDeletePlan(
  stores: Record<string, StoreResult>,
  kvItems: Array<{ share_id: string; found: boolean; value: unknown }>,
): { tables: DeletePlanEntry[]; kv_keys: string[]; hard_delete_implemented: false } {
  const ids = (storeName: string): string[] =>
    (stores[storeName]?.rows ?? [])
      .map((r) => r["id"])
      .filter((v): v is string => typeof v === "string");

  const tables: DeletePlanEntry[] = [
    { table: "waitlist_leads", strategy: "delete", would_affect_ids: ids("waitlist_leads") },
    {
      table: "venues",
      strategy: "review",
      would_affect_ids: ids("venues"),
      note: "Stripe/billing linkage — confirm subscription/retention rules before deleting.",
    },
    {
      table: "legal_acceptance",
      strategy: "review",
      would_affect_ids: ids("legal_acceptance"),
      note: "Legal-acceptance evidence — retention may be required; anonymize rather than delete if so.",
    },
    { table: "cookie_consent_log", strategy: "delete", would_affect_ids: ids("cookie_consent_log") },
    { table: "generation_events", strategy: "delete", would_affect_ids: ids("generation_events") },
    { table: "promo_permissions", strategy: "delete", would_affect_ids: ids("promo_permissions") },
    { table: "raffle_entries", strategy: "delete", would_affect_ids: ids("raffle_entries") },
  ];

  return {
    tables,
    kv_keys: kvItems.map((k) => `share:${k.share_id}`),
    hard_delete_implemented: false,
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error("✖ export failed:", errMsg(err));
  process.exit(1);
});
