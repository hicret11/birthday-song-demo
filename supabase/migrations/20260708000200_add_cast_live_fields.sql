-- Live (in-person) cast bookings — concierge MVP fields.
--
-- Phase 3b: alongside the AI phone call, a gift-giver can request a LIVE
-- performer (a musician or a costumed character) to appear at a birthday. These
-- are human-fulfilled by us as a concierge pilot (NOT a two-sided marketplace),
-- so a booking needs event logistics + a way to reach the booker, and two extra
-- fulfilment statuses the admin sets by hand.
--
-- Additive + idempotent: new nullable columns (AI-call bookings simply leave
-- them null), and the status check is widened to include 'contacted'/'confirmed'.

alter table public.cast_bookings
  add column if not exists city          text,   -- pilot city the event is in
  add column if not exists event_date    date,   -- when the live event happens
  add column if not exists address_note  text,   -- rough venue / address note
  add column if not exists contact_phone text,   -- how we reach the booker
  add column if not exists contact_email text;

-- Widen the status enum to the human-fulfilment states. Drop whatever the
-- existing single-column status check is named (inline checks get an
-- auto-generated name), then re-add the superset — done dynamically so it works
-- regardless of the original constraint name.
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.cast_bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.cast_bookings drop constraint %I', cname);
  end if;
end $$;

alter table public.cast_bookings
  add constraint cast_bookings_status_check
  check (status in (
    'pending', 'scheduled', 'calling', 'completed', 'failed', 'canceled',
    'contacted', 'confirmed'
  ));

create index if not exists cast_bookings_kind_status_idx
  on public.cast_bookings (kind, status, created_at desc);
