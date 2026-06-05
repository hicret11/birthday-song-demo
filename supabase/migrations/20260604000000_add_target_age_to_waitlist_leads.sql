-- Add target_age to waitlist_leads.
--
-- The inline COPPA gate now captures the recipient's age in years directly
-- ("How old are they turning?", an integer 1..120) instead of a date of birth.
-- target_is_minor is derived from this value (age < 18) exactly as before.
--
-- target_birthday is intentionally KEPT (nullable) as a legacy column so older
-- rows and any back-compat callers still validate; new rows from the inline
-- gate populate target_age and leave target_birthday null.

alter table public.waitlist_leads
  add column if not exists target_age integer;

-- Bound the value to a sane human range. Guarded so the migration is
-- idempotent (Postgres has no "add constraint if not exists").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'waitlist_target_age_range'
  ) then
    alter table public.waitlist_leads
      add constraint waitlist_target_age_range
      check (target_age is null or (target_age between 1 and 120));
  end if;
end $$;
