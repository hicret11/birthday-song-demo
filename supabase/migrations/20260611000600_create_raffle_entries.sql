-- Raffle / voucher entry log.
--
-- Phase 6: raffle/voucher participation kept legally separable from general
-- marketing consent. Append-only; written only when an active promotion is
-- configured (see lib/promotions.ts). No active promotion → no rows are ever
-- created. marketing_consent is stored independently and entering a raffle
-- never implies marketing opt-in.
--
-- Queryable by email, promotion, country, and time for export/deletion.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.raffle_entries (
  id                   uuid primary key default gen_random_uuid(),
  promotion_id         text not null,
  email                text not null,
  opted_in_at          timestamptz not null default now(),
  eligibility_country  text,
  eligibility_region   text,
  prize_terms_version  text,
  -- Separate from raffle opt-in by design: entering a raffle does NOT subscribe
  -- the user to marketing. Defaults false; only true if independently granted.
  marketing_consent    boolean not null default false,
  source               text,
  -- Optional link back to the originating waitlist_leads row, when available.
  waitlist_lead_id     uuid,
  anonymous_id         text,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- One entry per email per promotion. Implemented as a unique index on
-- lower(email)+promotion_id, which also serves the email lookup. Guarded so the
-- migration stays idempotent.
create unique index if not exists raffle_entries_email_promo_unique
  on public.raffle_entries (lower(email), promotion_id);

-- Reporting / export-deletion lookups.
create index if not exists raffle_entries_promotion_id_idx
  on public.raffle_entries (promotion_id);
create index if not exists raffle_entries_opted_in_at_idx
  on public.raffle_entries (opted_in_at);
create index if not exists raffle_entries_eligibility_country_idx
  on public.raffle_entries (eligibility_country);
