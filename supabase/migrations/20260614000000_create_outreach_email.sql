-- Phase C3a (admin): outreach email templates + activity/history for Alejandro.
--
-- Deterministic email DRAFTS only (no AI, no sending). Admin-only; RLS enabled
-- with NO policies (service-role access only). Templates are seeded idempotently.
--
-- Additive + idempotent — safe to re-run. No existing table is modified.

-- ── outreach_email_templates ────────────────────────────────────────────────
create table if not exists public.outreach_email_templates (
  id            uuid primary key default gen_random_uuid(),
  template_key  text not null unique,
  name          text not null,
  category_hint text,
  subject       text not null,
  body          text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── outreach_activity (append-only history) ─────────────────────────────────
create table if not exists public.outreach_activity (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.admin_outreach_leads(id) on delete cascade,
  action       text not null,
  template_key text,
  channel      text not null default 'email',
  note         text,
  actor        text,
  created_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_activity_action_chk') then
    alter table public.outreach_activity
      add constraint outreach_activity_action_chk
      check (action in ('drafted', 'contacted', 'replied', 'note', 'status_change'));
  end if;
end $$;

create index if not exists outreach_activity_lead_id_idx    on public.outreach_activity (lead_id);
create index if not exists outreach_activity_created_at_idx on public.outreach_activity (created_at desc);
create index if not exists outreach_activity_action_idx     on public.outreach_activity (action);

-- updated_at trigger (reuses the shared helper; redefined idempotently).
create or replace function public.smb_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'outreach_email_templates_set_updated_at') then
    create trigger outreach_email_templates_set_updated_at
      before update on public.outreach_email_templates
      for each row execute function public.smb_set_updated_at();
  end if;
end $$;

alter table public.outreach_email_templates enable row level security;
alter table public.outreach_activity        enable row level security;

-- ── Seed default templates (idempotent) ─────────────────────────────────────
-- Placeholders filled deterministically by lib/outreach/email.ts:
--   {{business_name}} {{city}} {{area}} {{category}} {{site}} {{sample_line}}
insert into public.outreach_email_templates (template_key, name, category_hint, subject, body) values
('venues', 'Birthday / event venues', 'birthday venue, event venue, party venue',
 'Personalized birthday songs for {{business_name}}''s celebrations',
 E'Hi {{business_name}} team,\n\nI''m with Sing My Birthday ({{site}}) — we create personalized birthday songs with the guest''s name right in the lyrics.\n\nSince {{business_name}} hosts celebrations in {{city}}, we''d love to explore a partnership: a custom birthday song to play or gift at each event, co-branded options, or a simple referral arrangement for your guests.\n{{sample_line}}Would you be open to a quick chat this week?\n\nBest,\nSing My Birthday\n{{site}}'),
('kids_party', 'Kids party / play areas', 'kids party, play area, kids entertainment',
 'A fun add-on for birthday parties at {{business_name}}',
 E'Hi {{business_name}} team,\n\nI''m with Sing My Birthday ({{site}}) — personalized birthday songs featuring the birthday child''s name.\n\nFor the parties you host in {{city}}, a custom song is a memorable, giftable add-on (played at the cake moment, or offered as a party extra). Happy to set up a partner or referral deal.\n{{sample_line}}Could we find 10 minutes to chat?\n\nBest,\nSing My Birthday\n{{site}}'),
('restaurants', 'Family restaurants', 'family restaurant, restaurant birthday',
 'Make birthday tables special at {{business_name}}',
 E'Hi {{business_name}} team,\n\nI''m with Sing My Birthday ({{site}}) — personalized birthday songs with the guest''s name in them.\n\nInstead of the usual clap at the birthday table in {{city}}, imagine playing a custom song made for the guest. We''d love to explore a simple partnership or referral.\n{{sample_line}}Open to a quick call?\n\nBest,\nSing My Birthday\n{{site}}'),
('hotels_events', 'Hotels / events', 'hotel, banquet, event, celebration',
 'Personalized birthday songs for events at {{business_name}}',
 E'Hi {{business_name}} team,\n\nI''m with Sing My Birthday ({{site}}) — we produce personalized birthday songs with the celebrant''s name in the lyrics.\n\nFor birthday events and packages at {{business_name}} in {{city}}, a bespoke song is a premium, shareable touch. We''d be glad to discuss a partnership or package add-on.\n{{sample_line}}Would a brief chat work?\n\nBest,\nSing My Birthday\n{{site}}'),
('bakeries_gifts', 'Bakeries / gift shops', 'cake shop, bakery, gift shop',
 'A perfect pairing for {{business_name}}''s birthday customers',
 E'Hi {{business_name}} team,\n\nI''m with Sing My Birthday ({{site}}) — personalized birthday songs with the recipient''s name in the lyrics.\n\nFor your birthday customers in {{city}}, a custom song pairs beautifully with a cake or gift — a great upsell or bundle. We''d love to explore a partnership or referral.\n{{sample_line}}Could we chat for a few minutes?\n\nBest,\nSing My Birthday\n{{site}}')
on conflict (template_key) do nothing;
