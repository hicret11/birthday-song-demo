-- Cookie-consent log.
--
-- One row per consent decision (banner Accept all / Reject non-essential, or a
-- Save from the preference center). Append-only audit trail: we never update or
-- delete rows here, so a user's full consent history is preserved for
-- compliance. Written by /api/consent.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.cookie_consent_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  choice            text not null,
  -- Per-category acceptance. `necessary` is always true (cannot be disabled).
  necessary         boolean not null default true,
  preferences       boolean not null default false,
  analytics         boolean not null default false,
  marketing         boolean not null default false,
  -- Versioning: the legal policy version in force, and the consent banner/UI
  -- version the user actually saw.
  policy_version    text not null,
  interface_version text not null,
  -- Identity: user_id when an account exists (none yet), otherwise an
  -- anonymous/session id from the client. Either may be null.
  user_id           text,
  anonymous_id      text,
  -- Geo, enriched server-side from edge headers; null when unavailable.
  country           text,
  region            text
);

-- Constrain `choice` to the known set. Guarded so the migration is idempotent
-- (Postgres has no "add constraint if not exists").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cookie_consent_choice_valid'
  ) then
    alter table public.cookie_consent_log
      add constraint cookie_consent_choice_valid
      check (choice in ('accept_all', 'reject_non_essential', 'custom'));
  end if;
end $$;

-- Lookups for export/deletion (by identity) and reporting (by time).
create index if not exists cookie_consent_log_anonymous_id_idx
  on public.cookie_consent_log (anonymous_id);
create index if not exists cookie_consent_log_user_id_idx
  on public.cookie_consent_log (user_id);
create index if not exists cookie_consent_log_created_at_idx
  on public.cookie_consent_log (created_at);
