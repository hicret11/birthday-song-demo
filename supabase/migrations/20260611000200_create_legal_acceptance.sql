-- Legal-acceptance evidence log.
--
-- One row per purchase where the user accepted the Terms and acknowledged the
-- Privacy Policy on the way into Stripe Checkout. Append-only audit trail —
-- never updated or deleted — so acceptance evidence is preserved.
--
-- Written by the Stripe webhook (customer.subscription.created/updated) using
-- metadata stamped onto the subscription at checkout time. Queryable by email,
-- Stripe customer/session/subscription, and time.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.legal_acceptance (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  -- When the user actually accepted (checkout creation time). May differ from
  -- created_at, which is when the webhook wrote the row.
  accepted_at            timestamptz,
  email                  text,
  -- Versions accepted/acknowledged, and the surface that captured acceptance.
  terms_version          text not null,
  privacy_version        text not null,
  acceptance_surface     text not null,
  acceptance_version     text not null,
  -- Stripe linkage — any may be null depending on what the event exposed.
  stripe_customer_id     text,
  stripe_session_id      text,
  stripe_subscription_id text,
  stripe_price_id        text,
  -- Geo captured at checkout time (the webhook request comes from Stripe, so
  -- geo must be stamped client-side at checkout, not read in the webhook).
  country                text,
  region                 text
);

-- Dedup key: a subscription's acceptance at a given acceptance version is
-- recorded once. customer.subscription.updated fires repeatedly, so this keeps
-- repeat events harmless (ON CONFLICT DO NOTHING in the webhook). Guarded so
-- the migration stays idempotent (Postgres has no "add constraint if not
-- exists").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'legal_acceptance_sub_version_unique'
  ) then
    alter table public.legal_acceptance
      add constraint legal_acceptance_sub_version_unique
      unique (stripe_subscription_id, acceptance_version);
  end if;
end $$;

-- Lookups for export/deletion (by identity) and reporting (by time).
create index if not exists legal_acceptance_email_idx
  on public.legal_acceptance (lower(email));
create index if not exists legal_acceptance_customer_idx
  on public.legal_acceptance (stripe_customer_id);
create index if not exists legal_acceptance_session_idx
  on public.legal_acceptance (stripe_session_id);
create index if not exists legal_acceptance_created_at_idx
  on public.legal_acceptance (created_at);
