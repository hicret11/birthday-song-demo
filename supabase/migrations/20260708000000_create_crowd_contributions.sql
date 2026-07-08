-- Crowd-magic contributions.
--
-- Phase 2 of the reimagined "production studio": a gift-giver shares a secret
-- link and the birthday person's circle each adds a line, a memory, or a wish.
-- These are woven into ONE song, so the recipient feels loved by many.
--
-- The gift/song itself lives in Vercel KV (see lib/share.ts). Contributions
-- live HERE in Postgres because they are durable, queryable, moderatable, and
-- (later) Supabase-Realtime-broadcastable. They reference the KV share id via
-- gift_id (a text id, not a FK — the two stores are intentionally separate).
--
-- Access is server-side only via the service role (RLS on, no public policy),
-- which bypasses RLS. Live updates use Supabase Realtime *Broadcast*, which does
-- not require table read policies, so enabling RLS here is safe.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.crowd_contributions (
  id            uuid primary key default gen_random_uuid(),
  gift_id       text not null,                       -- KV share id of the gift
  author_token  text not null,                       -- anonymous per-contributor cookie token
  author_name   text,                                -- optional display name ("from Grandma")
  kind          text not null default 'line'
                  check (kind in ('line', 'memory', 'wish', 'photo', 'voice')),
  content       text,                                -- text body for line/memory/wish
  content_url   text,                                -- media URL for photo/voice (Phase 2b)
  status        text not null default 'approved'
                  check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

-- Primary access pattern: fetch a gift's approved contributions in order.
create index if not exists crowd_contributions_gift_idx
  on public.crowd_contributions (gift_id, created_at);

-- Guard against a single contributor spamming one gift (also enforced app-side).
create index if not exists crowd_contributions_author_idx
  on public.crowd_contributions (gift_id, author_token);

alter table public.crowd_contributions enable row level security;
-- No policies: all reads/writes go through the service-role key server-side,
-- which bypasses RLS. Realtime uses Broadcast, not Postgres Changes.
