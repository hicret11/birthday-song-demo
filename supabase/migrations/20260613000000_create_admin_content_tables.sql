-- Phase B (admin dashboard): content-package approval workflow.
--
-- Two additive admin-only tables that let Hicrete review post-ready product
-- packages and record approve/decline decisions. These are written/read ONLY
-- server-side with the Supabase service role (which bypasses RLS). RLS is
-- enabled with NO policies, so anon/authenticated clients can see nothing.
--
-- Privacy: NO emails or sensitive PII are stored here — recipient_first_name
-- only (already public on the share page). Permission state mirrors the
-- fail-closed logic used by the package-share CLI.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

-- ── admin_content_packages ──────────────────────────────────────────────────
create table if not exists public.admin_content_packages (
  id                      uuid primary key default gen_random_uuid(),
  share_id                text not null unique,
  permission_bucket       text not null,
  status                  text not null,
  recipient_first_name    text,
  genre                   text,
  language                text,
  template                text,
  video_url               text,
  audio_url               text,
  thumbnail_url           text,
  share_page_url          text,
  promo_granted           boolean not null default false,
  is_minor_recipient      boolean not null default false,
  permission_text_version text,
  policy_version          text,
  packaged_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Guarded check constraints (ALTER ... ADD CONSTRAINT is not idempotent on its
-- own, so we add only when the named constraint is absent).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_content_packages_status_chk') then
    alter table public.admin_content_packages
      add constraint admin_content_packages_status_chk
      check (status in (
        'needs-permission',
        'private-share-only',
        'approved-for-promo',
        'pending-review',
        'approved-by-hicrete',
        'declined-by-hicrete',
        'posted'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'admin_content_packages_bucket_chk') then
    alter table public.admin_content_packages
      add constraint admin_content_packages_bucket_chk
      check (permission_bucket in (
        'needs-permission',
        'private-share-only',
        'approved-for-promo'
      ));
  end if;
end $$;

-- Indexes (share_id uniqueness is already enforced by the inline UNIQUE above).
create index if not exists admin_content_packages_status_idx
  on public.admin_content_packages (status);
create index if not exists admin_content_packages_bucket_idx
  on public.admin_content_packages (permission_bucket);
create index if not exists admin_content_packages_created_at_idx
  on public.admin_content_packages (created_at desc);
create index if not exists admin_content_packages_promo_granted_idx
  on public.admin_content_packages (promo_granted);
create index if not exists admin_content_packages_is_minor_idx
  on public.admin_content_packages (is_minor_recipient);

-- ── admin_content_approvals ─────────────────────────────────────────────────
create table if not exists public.admin_content_approvals (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid not null references public.admin_content_packages(id) on delete cascade,
  action      text not null,
  actor       text,
  note        text,
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_content_approvals_action_chk') then
    alter table public.admin_content_approvals
      add constraint admin_content_approvals_action_chk
      check (action in ('approve', 'decline', 'mark-posted', 'reset-review'));
  end if;
end $$;

create index if not exists admin_content_approvals_package_id_idx
  on public.admin_content_approvals (package_id);
create index if not exists admin_content_approvals_created_at_idx
  on public.admin_content_approvals (created_at desc);
create index if not exists admin_content_approvals_action_idx
  on public.admin_content_approvals (action);

-- ── updated_at trigger (no existing repo pattern — add a guarded local one) ──
create or replace function public.smb_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'admin_content_packages_set_updated_at'
  ) then
    create trigger admin_content_packages_set_updated_at
      before update on public.admin_content_packages
      for each row execute function public.smb_set_updated_at();
  end if;
end $$;

-- ── Row-Level Security: enable, add NO policies (service-role-only access) ───
-- The service role bypasses RLS; with no policies, anon/authenticated roles can
-- neither read nor write. Do not add public/anon policies to these tables.
alter table public.admin_content_packages enable row level security;
alter table public.admin_content_approvals enable row level security;
