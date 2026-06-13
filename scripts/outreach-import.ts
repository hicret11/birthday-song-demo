/**
 * Manual outreach-lead import (no API keys, no scraping). Reads a curated
 * CSV or JSON file of UAE venue/business leads, normalizes + scores them, and
 * dedup-upserts into admin_outreach_leads. Human-edited status/owner/notes on
 * existing rows are preserved.
 *
 * Usage:
 *   npm run outreach:import -- --file=scripts/outreach-leads.example.json
 *   npm run outreach:import -- --file=leads.csv --dry
 *   npm run outreach:import -- --file=leads.csv --source=manual_dubai
 *
 * JSON: an array of objects, or { "leads": [ ... ] }.
 * CSV:  header row of column names; quoted fields may contain commas.
 * Recognized columns: business_name (required), source, source_place_id, category,
 *   country, city, area, address, website_url, phone, email, instagram_url,
 *   google_maps_url, rating, review_count.
 */

import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { normalizeLead, type NormalizedLead } from "../lib/outreach/provider";
import { upsertLeads } from "../lib/admin-outreach";

// Load env (service-role key etc.) without printing or overwriting existing values.
for (const file of [".env.production.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function arg(name: string): string | undefined {
  const a = process.argv.slice(2).find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}
const FILE = arg("file");
const DRY = process.argv.includes("--dry");
const SOURCE = arg("source");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// Minimal CSV parser: handles double-quoted fields containing commas/quotes.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length) { row.push(field); rows.push(row); field = ""; row = []; }
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function main() {
  if (!FILE) die("Missing --file=<path> (.json or .csv)");
  if (!existsSync(FILE)) die(`File not found: ${FILE}`);
  const raw = readFileSync(FILE, "utf8");

  let records: Record<string, unknown>[];
  if (FILE.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.leads) ? parsed.leads : die("JSON must be an array or { leads: [...] }");
  } else if (FILE.toLowerCase().endsWith(".csv")) {
    records = parseCsv(raw);
  } else {
    die("Unsupported file type — use .json or .csv");
  }

  const normalized: NormalizedLead[] = [];
  let dropped = 0;
  for (const r of records) {
    const n = normalizeLead(r, { source: SOURCE });
    if (n) normalized.push(n); else dropped++;
  }
  console.log(`\n=== outreach:import ${DRY ? "[dry]" : ""} ===`);
  console.log(`file: ${FILE} | parsed: ${records.length} | usable: ${normalized.length} | dropped (no business_name): ${dropped}`);

  if (normalized.length === 0) die("No usable leads (every row needs a business_name).");

  const result = await upsertLeads(normalized, { dry: DRY });
  if (result.missing) die(result.error || "admin_outreach_leads not found — apply the Phase C migration first.");
  if (result.error) die(result.error);

  console.log(`${DRY ? "[dry] would " : ""}insert: ${result.inserted} | ${DRY ? "would " : ""}update: ${result.updated} | skipped: ${result.skipped}`);
  console.log(DRY ? "(dry run — nothing written)" : "done. View them in /admin/outreach.");
  console.log("");
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
