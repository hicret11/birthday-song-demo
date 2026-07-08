-- Group split payment ("chip in") contributions.
--
-- Instead of one buyer paying the full unlock price, several friends can each
-- CHIP IN a partial amount toward one gift's price. When the running total of
-- paid contributions reaches the gift's price, the shared unlock path flips the
-- song open (exactly the same unlock a solo purchase triggers).
--
-- The gift/song itself lives in Vercel KV (see lib/share.ts); each paid chip-in
-- is recorded HERE in Postgres because it's durable, summable, and auditable.
-- Rows reference the KV share id via gift_id (a text id, NOT a FK — the two
-- stores are intentionally separate, mirroring crowd_contributions).
--
-- A row is written ONLY from the Stripe webhook after a chip-in payment
-- completes, so status is 'paid' by default. It is keyed uniquely on
-- stripe_payment_id so a redelivered webhook can never double-count a payment
-- (insert ... on conflict do nothing). RLS is on with no policies: all access
-- is server-side via the service role, which bypasses RLS.
--
-- Additive + idempotent — safe to re-run. No existing table is modified. This
-- ships behind the GROUP_PAY_ENABLED flag (off by default), so it has no effect
-- on the existing solo unlock path.

create table if not exists public.gift_contributions_pay (
  id                 uuid primary key default gen_random_uuid(),
  gift_id            text not null,                       -- KV share id of the gift
  contributor_token  text not null,                       -- anonymous per-contributor cookie token
  amount_cents       integer not null check (amount_cents > 0),
  stripe_payment_id  text not null unique,                -- payment_intent (or session id) — idempotency key
  status             text not null default 'paid'
                       check (status in ('paid', 'refunded')),
  created_at         timestamptz not null default now()
);

-- Primary access pattern: sum a gift's paid chip-ins to compare against price.
create index if not exists gift_contributions_pay_gift_idx
  on public.gift_contributions_pay (gift_id, created_at);

alter table public.gift_contributions_pay enable row level security;
-- No policies: all reads/writes go through the service-role key server-side,
-- which bypasses RLS.
