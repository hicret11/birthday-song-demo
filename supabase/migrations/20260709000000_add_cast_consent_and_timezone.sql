-- Cast bookings — consent evidence + recipient timezone (compliance hardening).
--
-- The AI character call uses a giver-attests consent model: the gift-giver
-- represents they have the recipient's permission to receive the call. US TCPA
-- treatment of AI/artificial-voice calls (FCC Declaratory Ruling, Feb 2024)
-- puts the burden of proof on the caller, so we persist a durable evidence
-- trail of that attestation — when it was made, from what IP, and the exact
-- words the giver agreed to. recipient_timezone drives the quiet-hours guard
-- (calls only 8am–9pm local; see lib/cast/quiet-hours.ts + the cast-calls cron).
--
-- Additive + idempotent. All columns nullable so existing rows are unaffected.

alter table public.cast_bookings
  add column if not exists consent_ip          text,
  add column if not exists consent_attestation text,
  add column if not exists consent_at          timestamptz,
  add column if not exists recipient_timezone  text;

-- One AI-call booking per gift/share — closes the webhook double-delivery race
-- that the getAiCallBookingForGift() guard covers in the common case.
create unique index if not exists cast_bookings_one_ai_call_per_gift
  on public.cast_bookings (gift_id)
  where kind = 'ai_call' and gift_id is not null;
