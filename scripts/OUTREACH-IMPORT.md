# UAE Outreach — manual lead collection & import (Alejandro)

Collect real UAE birthday/event venues into a spreadsheet, then import them into
the admin Outreach board. **No scraping** — only public, business-level contact
info you can copy by hand from public listings. No Google Places/paid API needed.

## 1. Fill the template
Start from `scripts/outreach-leads.template.csv` (header row below). One business
per row. Save as a real file, e.g. `outreach-leads.csv` (keep it out of git).

| Column | Required | Example | Notes |
|---|---|---|---|
| `business_name` | ✅ yes | `Cheeky Monkeys Play Area` | The only required column. |
| `category` | no | `kids play area` | Free text — e.g. event venue, bakery, hotel, party planner. |
| `city` | no | `Dubai` | Used for dedup + filtering. |
| `area` | no | `Jumeirah` | Neighborhood/district. |
| `address` | no | `Jumeirah Beach Road, Dubai` | |
| `website_url` | no | `https://example.com` | |
| `phone` | no | `+971 4 000 0000` | Business phone only. |
| `google_maps_url` | no | `https://maps.google.com/?q=...` | The "share" link from Google Maps. |
| `rating` | no | `4.5` | Number 0–5. Feeds the relevance score. |
| `review_count` | no | `320` | Integer. Feeds the relevance score. |
| `notes` | no | `Asked for partnerships contact` | **Collected for your reference; NOT imported.** Add/maintain notes in `/admin/outreach` after import. |

**Only collect public business contact data.** Do **not** collect personal emails
or personal social handles, and do not scrape any website. Respect UAE anti-spam
rules when you actually contact leads.

Example filled row:
```csv
business_name,category,city,area,address,website_url,phone,google_maps_url,rating,review_count,notes
Cheeky Monkeys Play Area,kids play area,Dubai,Jumeirah,Jumeirah Beach Road,https://example.com,+971 4 000 0000,https://maps.google.com/?q=cheeky+monkeys,4.5,320,
```

## 2. Dry-run (writes nothing — always do this first)
```bash
npm run outreach:import -- --file=outreach-leads.csv --dry
```
Shows parsed / usable / would-insert / would-update counts. Fix the file if any
rows are "dropped (no business_name)".

## 3. Import (writes to the Outreach board)
```bash
npm run outreach:import -- --file=outreach-leads.csv
```
- Dedup-aware **upsert**: a lead matching an existing one (by `source+source_place_id`,
  else `lower(business_name)+city`) is **refreshed**, not duplicated.
- Re-running is safe: it **preserves** the `status`, `owner`, and `notes` you set in
  the UI — only business fields + `last_seen_at` get refreshed.
- JSON is also supported (`--file=leads.json`, an array or `{ "leads": [...] }`).

## 4. Work the leads in `/admin/outreach`
- Filter by city / category / status / min rating / search.
- Per row: set **status** (new → shortlisted → contacted → replied → partnered, or
  not_relevant), assign **owner** (e.g. Alejandro), and add **notes**. These edits
  are preserved across future re-imports.

## Not in scope (yet)
- No automatic discovery provider is configured (`/admin/outreach` shows
  "source not configured"). Phase C2 may add Google Places behind a key.
- No cron, no `CRON_SECRET`, no auto-posting, no scraping.
