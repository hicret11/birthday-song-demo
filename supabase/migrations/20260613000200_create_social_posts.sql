-- Phase C1 (admin): manual social posting tracker for Hicrete.
--
-- Tracks planned/posted/skipped social posts. NO auto-posting, NO social API,
-- NO scraping — purely a manual log. Admin-only; RLS enabled with NO policies
-- (service-role access only).
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.social_posts (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null,
  share_id    text,
  package_id  uuid references public.admin_content_packages(id) on delete set null,
  post_url    text,
  caption     text,
  status      text not null default 'planned',
  posted_at   timestamptz,
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_posts_platform_chk') then
    alter table public.social_posts
      add constraint social_posts_platform_chk
      check (platform in ('tiktok', 'instagram', 'youtube_shorts', 'facebook'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'social_posts_status_chk') then
    alter table public.social_posts
      add constraint social_posts_status_chk
      check (status in ('planned', 'posted', 'skipped'));
  end if;
end $$;

create index if not exists social_posts_status_idx    on public.social_posts (status);
create index if not exists social_posts_platform_idx  on public.social_posts (platform);
create index if not exists social_posts_posted_at_idx on public.social_posts (posted_at desc);
create index if not exists social_posts_share_id_idx  on public.social_posts (share_id);

create or replace function public.smb_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'social_posts_set_updated_at') then
    create trigger social_posts_set_updated_at
      before update on public.social_posts
      for each row execute function public.smb_set_updated_at();
  end if;
end $$;

alter table public.social_posts enable row level security;
