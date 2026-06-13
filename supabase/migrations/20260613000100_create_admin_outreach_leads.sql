-- Phase C1 (admin): UAE venue/business outreach leads for Alejandro.
--
-- Internal B2B outreach working set — admin-only, service-role access. RLS is
-- enabled with NO policies (anon/authenticated see nothing). Populated via the
-- manual import CLI (`npm run outreach:import`) and, later, an env-gated provider
-- (e.g. Google Places). Business-level public contact data only — no scraping.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

create table if not exists public.admin_outreach_leads (
  id               uuid primary key default gen_random_uuid(),
  source           text not null default 'manual_import',
  source_place_id  text,
  business_name    text not null,
  category         text,
  country          text not null default 'AE',
  city             text,
  area             text,
  address          text,
  website_url      text,
  phone            text,
  email            text,
  instagram_url    text,
  google_maps_url  text,
  rating           numeric,
  review_count     integer,
  relevance_score  integer,
  outreach_status  text not null default 'new',
  owner            text,
  notes            text,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_outreach_leads_status_chk') then
    alter table public.admin_outreach_leads
      add constraint admin_outreach_leads_status_chk
      check (outreach_status in ('new', 'shortlisted', 'contacted', 'replied', 'not_relevant', 'partnered'));
  end if;
end $$;

-- Dedup: by (source, source_place_id) when a place id is present; otherwise by
-- (lower(business_name), city). Two partial unique indexes.
create unique index if not exists admin_outreach_leads_place_unique
  on public.admin_outreach_leads (source, source_place_id) where source_place_id is not null;
create unique index if not exists admin_outreach_leads_name_city_unique
  on public.admin_outreach_leads (lower(business_name), city) where source_place_id is null;

create index if not exists admin_outreach_leads_status_idx    on public.admin_outreach_leads (outreach_status);
create index if not exists admin_outreach_leads_city_idx      on public.admin_outreach_leads (city);
create index if not exists admin_outreach_leads_category_idx  on public.admin_outreach_leads (category);
create index if not exists admin_outreach_leads_score_idx     on public.admin_outreach_leads (relevance_score desc);
create index if not exists admin_outreach_leads_last_seen_idx on public.admin_outreach_leads (last_seen_at desc);

-- updated_at trigger (reuses the helper from the Phase B migration; redefined
-- idempotently here so this migration is safe to run independently).
create or replace function public.smb_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'admin_outreach_leads_set_updated_at') then
    create trigger admin_outreach_leads_set_updated_at
      before update on public.admin_outreach_leads
      for each row execute function public.smb_set_updated_at();
  end if;
end $$;

alter table public.admin_outreach_leads enable row level security;
