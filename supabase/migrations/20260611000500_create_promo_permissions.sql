-- Promotional-use permission log.
--
-- Phase 5: explicit, optional permission for Sing My Birthday to feature a
-- user's song/testimonial/story in promotional material. We do NOT assume this
-- right — it must be granted. Append-only evidence trail: one row per grant or
-- explicit decline, never updated.
--
-- Written best-effort by /api/promo-permission. Queryable by email, anonymous
-- id, and share id for export/deletion.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.promo_permissions (
  id                      uuid primary key default gen_random_uuid(),
  granted                 boolean not null,
  granted_at              timestamptz not null default now(),
  email                   text,
  anonymous_id            text,
  share_id                text,
  recipient_name          text,
  -- Whether the song's recipient is a minor. Promo permission is never stored
  -- as granted=true for a minor-recipient flow (forced false server-side).
  is_minor_recipient      boolean,
  permission_text_version text not null,
  policy_version          text not null,
  country                 text,
  region                  text,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now()
);

-- Lookups for export/deletion (by identity / share) and reporting (by time).
create index if not exists promo_permissions_email_idx
  on public.promo_permissions (lower(email));
create index if not exists promo_permissions_anonymous_id_idx
  on public.promo_permissions (anonymous_id);
create index if not exists promo_permissions_share_id_idx
  on public.promo_permissions (share_id);
create index if not exists promo_permissions_granted_at_idx
  on public.promo_permissions (granted_at);
