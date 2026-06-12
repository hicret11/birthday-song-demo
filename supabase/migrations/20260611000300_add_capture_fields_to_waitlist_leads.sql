-- Add structured free-generation capture fields to waitlist_leads.
--
-- Phase 3 of the legal/compliance work: store the data the generation flow
-- already collects (recipient name, language, genre, relationship) plus geo and
-- optional marketing/reminder + raffle opt-ins, so the consent log is complete
-- and queryable. All columns are nullable and additive — existing rows and
-- existing capture payloads keep working unchanged.
--
-- NOTE: target_under_13 and child_consent_version are intentionally NOT added
-- here — they were added in 20260611000100_add_under_13_to_waitlist_leads.sql.
--
-- Additive + idempotent — safe to re-run.

alter table public.waitlist_leads
  add column if not exists recipient_name text;

alter table public.waitlist_leads
  add column if not exists language text;

alter table public.waitlist_leads
  add column if not exists genre text;

alter table public.waitlist_leads
  add column if not exists relationship text;

-- Geo, enriched server-side from edge headers (null when unavailable).
alter table public.waitlist_leads
  add column if not exists country text;

alter table public.waitlist_leads
  add column if not exists region text;

-- Optional consent for marketing/birthday-reminder emails. Distinct from the
-- COPPA parental consent. Defaults false; never set on child-recipient flows.
alter table public.waitlist_leads
  add column if not exists marketing_reminder_consent boolean not null default false;

-- Raffle/voucher opt-in — kept separate from marketing consent and nullable
-- (null = not offered / not answered). promotion_id ties an opt-in to a
-- specific promotion when one is active.
alter table public.waitlist_leads
  add column if not exists raffle_opt_in boolean;

alter table public.waitlist_leads
  add column if not exists promotion_id text;

-- Which capture/policy version was in force when this row was written.
alter table public.waitlist_leads
  add column if not exists capture_version text;
