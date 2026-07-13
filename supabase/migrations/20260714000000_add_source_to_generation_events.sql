-- Add first-touch traffic attribution to the generation event log.
--
-- `source`  — a coarse channel label (utm_source, our own ?src= tag, a referrer
--             host like "whatsapp"/"google", or "direct"), captured client-side
--             on first touch (see lib/attribution).
-- `referrer`— the raw referrer hostname, when present.
--
-- Lets us answer "which channels bring visitors/buyers, by country?" straight
-- from SQL, joined with the country/region already on each row.
--
-- Additive + idempotent — safe to re-run. Nullable columns, no backfill, no
-- change to existing rows or writers that don't set them.

alter table public.generation_events add column if not exists source   text;
alter table public.generation_events add column if not exists referrer text;

create index if not exists generation_events_source_idx
  on public.generation_events (source);
