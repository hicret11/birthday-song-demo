-- Add explicit under-13 status + child consent version to waitlist_leads.
--
-- The existing gate already blocks all minors under 18 and records parental
-- consent (target_is_minor / parental_consent_given / parental_consent_at).
-- This migration does NOT relax that stricter gate — it only adds an explicit,
-- separately-queryable under-13 flag (derived server-side from the recipient's
-- age) and the consent/policy version in force when child consent was given.
--
-- Additive + idempotent — safe to re-run.

alter table public.waitlist_leads
  add column if not exists target_under_13 boolean;

alter table public.waitlist_leads
  add column if not exists child_consent_version text;
