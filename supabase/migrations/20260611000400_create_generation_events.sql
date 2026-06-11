-- Durable generation/playback/download/share event log.
--
-- Phase 4: a lightweight, append-only audit trail of song-flow activity so the
-- data can later be found/exported/deleted by email, anonymous id, or share id.
-- This is NOT a full analytics platform — it is first-party operational/audit
-- data written best-effort from server routes and a small /api/events endpoint.
--
-- Append-only: rows are never updated. metadata holds bounded, non-sensitive
-- extra context only.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.generation_events (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,
  occurred_at     timestamptz not null default now(),
  email           text,
  anonymous_id    text,
  share_id        text,
  venue_slug      text,
  recipient_name  text,
  language        text,
  genre           text,
  country         text,
  region          text,
  policy_version  text,
  capture_version text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- Lookups for export/deletion (by identity / share) and reporting (by type/time).
create index if not exists generation_events_email_idx
  on public.generation_events (lower(email));
create index if not exists generation_events_anonymous_id_idx
  on public.generation_events (anonymous_id);
create index if not exists generation_events_share_id_idx
  on public.generation_events (share_id);
create index if not exists generation_events_event_type_idx
  on public.generation_events (event_type);
create index if not exists generation_events_occurred_at_idx
  on public.generation_events (occurred_at);
