-- Cast bookings — "beyond digital" birthday experiences.
--
-- Phase 3 of the reimagined product: a gift-giver books a CHARACTER to phone the
-- birthday person and congratulate them (AI voice, via ElevenLabs + Twilio).
-- Only ORIGINAL/archetype characters we own are offered (never a trademarked or
-- celebrity likeness), and every call opens with a clear AI disclosure — see
-- lib/cast/characters.ts and lib/cast/place-call.ts. This table is the durable
-- record of a booking + its fulfilment status.
--
-- A booking may reference a gift (KV share id) or stand alone. Access is
-- server-side via the service role (RLS on, no policy). Additive + idempotent.

create table if not exists public.cast_bookings (
  id                 uuid primary key default gen_random_uuid(),
  gift_id            text,                                -- optional KV share id
  kind               text not null default 'ai_call'
                       check (kind in ('ai_call', 'live_musician', 'character_visit')),
  character_id       text not null,                       -- id from the character library
  recipient_name     text not null,
  recipient_phone    text,                                -- E.164, for ai_call
  language           text not null default 'English',
  personal_note      text,                                -- optional, woven into the greeting
  scheduled_at       timestamptz,                         -- when to place the call
  consent_confirmed  boolean not null default false,      -- booker attests recipient consents
  status             text not null default 'pending'
                       check (status in ('pending', 'scheduled', 'calling', 'completed', 'failed', 'canceled')),
  stripe_payment_id  text,
  booker_token       text,                                -- anonymous cookie of the booker
  result_note        text,                                -- fulfilment detail / error
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists cast_bookings_status_idx
  on public.cast_bookings (status, scheduled_at);
create index if not exists cast_bookings_gift_idx
  on public.cast_bookings (gift_id);

alter table public.cast_bookings enable row level security;
-- No policies: all access via the service-role key server-side (bypasses RLS).
