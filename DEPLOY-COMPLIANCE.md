# Legal/Compliance Launch — Deployment Runbook (Phases 1–7)

Audience: Alejandro, Nilyufar, Ray. Follow top to bottom. Commands are
copy-pasteable; SQL runs in the Supabase SQL editor (project
`utreftnsnjbndmgezfpe`, shared across all envs).

**Deploy path (do NOT change):** branch → PR → merge to `main` → Vercel
auto-builds production. **Never run `vercel --prod` from a laptop** (see
`DEPLOY.md`). Migrations apply automatically in the production build via
`vercel.json` → `node scripts/apply-migrations.mjs && next build`. If a migration
fails, **the build fails and nothing goes live** — the code can never get ahead
of its schema.

---

## 1. Pre-deploy checks (run locally before opening the PR)

```bash
# 1a. The Phase 1–7 work is currently uncommitted on local `main`. Move it to a
#     branch and open a PR (never commit straight to main).
git status --short                       # expect the Phase 1–7 files (new + modified)
git checkout -b legal-compliance-phases-1-7
git add -A
git commit -m "Legal/compliance pack: consent, acceptance, capture, events, promo, raffle, privacy tooling"
git push -u origin legal-compliance-phases-1-7
# open the PR on GitHub (hicret11/birthday-song-demo)

# 1b. Lint — expect ONLY pre-existing issues (33 problems: share templates,
#     Confetti, resend, scripts, GeneratorClient/shared.tsx). Zero new files flagged.
npm run lint

# 1c. Build + typecheck — expect "✓ Compiled successfully".
npm run build

# 1d. Confirm the 7 new migrations are present and committed.
ls supabase/migrations
#   20260611000000_create_cookie_consent_log.sql
#   20260611000100_add_under_13_to_waitlist_leads.sql
#   20260611000200_create_legal_acceptance.sql
#   20260611000300_add_capture_fields_to_waitlist_leads.sql
#   20260611000400_create_generation_events.sql
#   20260611000500_create_promo_permissions.sql
#   20260611000600_create_raffle_entries.sql

# 1e. Dry-run what would apply to prod (read-only, no changes).
npm run db:migrate:check

# 1f. Confirm PII exports are gitignored (expect: privacy-exports/ printed).
git check-ignore privacy-exports/ ; git ls-files privacy-exports/   # 2nd cmd prints nothing
```

- [ ] PR opened from a branch (not a direct push to `main`)
- [ ] `npm run lint` — no **new** issues vs the pre-existing baseline
- [ ] `npm run build` — green
- [ ] All 7 migrations committed in the PR
- [ ] `.env` requirements confirmed (see §4)
- [ ] `privacy-exports/` is gitignored
- [ ] **Legal text PDF sign-off obtained** — `content/legal/{terms,privacy,cookies}-v1.0.txt`
      confirmed verbatim against the approved ToS / Privacy / Cookie PDFs. **Launch-blocking.**

---

## 2. Migration checklist

After the production build, confirm each object exists. **Fast check — all 5 new
tables at once:**

```sql
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('cookie_consent_log','legal_acceptance',
                     'generation_events','promo_permissions','raffle_entries')
order by table_name;
-- expect 5 rows
```

Per-migration detail:

### 2.1 `cookie_consent_log` (20260611000000)
Columns: `id, created_at, choice, necessary, preferences, analytics, marketing,
policy_version, interface_version, user_id, anonymous_id, country, region`.
```sql
select count(*) from information_schema.columns
where table_schema='public' and table_name='cookie_consent_log';   -- expect 13
```

### 2.2 `waitlist_leads` under-13 (20260611000100)
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='waitlist_leads'
  and column_name in ('target_under_13','child_consent_version');  -- expect 2 rows
```

### 2.3 `legal_acceptance` (20260611000200)
Columns: `id, created_at, accepted_at, email, terms_version, privacy_version,
acceptance_surface, acceptance_version, stripe_customer_id, stripe_session_id,
stripe_subscription_id, stripe_price_id, country, region`.
```sql
select to_regclass('public.legal_acceptance') is not null as exists;   -- expect true
-- unique key present:
select conname from pg_constraint where conname='legal_acceptance_sub_version_unique';
```

### 2.4 `waitlist_leads` capture fields (20260611000300)
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='waitlist_leads'
  and column_name in ('recipient_name','language','genre','relationship',
      'country','region','marketing_reminder_consent','raffle_opt_in',
      'promotion_id','capture_version');                            -- expect 10 rows
```

### 2.5 `generation_events` (20260611000400)
Columns: `id, event_type, occurred_at, email, anonymous_id, share_id, venue_slug,
recipient_name, language, genre, country, region, policy_version, capture_version,
metadata, created_at`.
```sql
select count(*) from information_schema.columns
where table_schema='public' and table_name='generation_events';    -- expect 16
```

### 2.6 `promo_permissions` (20260611000500)
Columns: `id, granted, granted_at, email, anonymous_id, share_id, recipient_name,
is_minor_recipient, permission_text_version, policy_version, country, region,
metadata, created_at`.
```sql
select count(*) from information_schema.columns
where table_schema='public' and table_name='promo_permissions';    -- expect 14
```

### 2.7 `raffle_entries` (20260611000600)
Columns: `id, promotion_id, email, opted_in_at, eligibility_country,
eligibility_region, prize_terms_version, marketing_consent, source,
waitlist_lead_id, anonymous_id, metadata, created_at`.
```sql
select to_regclass('public.raffle_entries') is not null as exists;  -- expect true
-- dedupe index present:
select indexname from pg_indexes
where tablename='raffle_entries' and indexname='raffle_entries_email_promo_unique';
```

- [ ] Build logs show `[migrate]` lines ran cleanly (`vercel inspect <url> --logs`)
- [ ] All 5 new tables + 12 new `waitlist_leads` columns confirmed

---

## 3. Live verification checklist (post-deploy, against singmybirthday.com)

Replace `$B` with `https://singmybirthday.com`.

### 3.1 Legal pages + footer
```bash
for p in terms privacy cookies; do
  echo "== /$p =="; curl -s $B/$p | grep -oE "V1\.0|May 29, 2026|GLOBAL MOBILITY TECHNOLOGIES LLC" | sort -u
done
```
- [ ] Each page returns **V1.0**, **Friday, May 29, 2026**, **GLOBAL MOBILITY TECHNOLOGIES LLC**
- [ ] Footer Terms / Privacy / Cookies links navigate correctly on a content page

### 3.2 Cookie banner + analytics gating (browser, fresh/incognito)
- [ ] Banner appears on first visit with the exact copy + Accept all / Reject non-essential / Manage preferences
- [ ] **Reject non-essential** → DevTools Network shows **no** `/_vercel/insights` request (Analytics unmounted)
- [ ] **Accept all** → `/_vercel/insights/script.js` loads (Analytics mounted)
- [ ] Footer **Cookie Preferences** reopens the preference center
- [ ] Reload after a choice → banner does not reappear (decision persisted)

### 3.3 Consent logging
After Accept/Reject in the browser:
```sql
select choice, analytics, marketing, policy_version, interface_version,
       anonymous_id, country, region, created_at
from public.cookie_consent_log order by created_at desc limit 5;
```
- [ ] A row exists with the chosen categories, `policy_version=V1.0`, `interface_version=V1.0`, an `anonymous_id`, and geo (country/region populated on the edge)

### 3.4 Stripe legal acceptance (Stripe **test mode**)
Complete a test checkout from `/become-a-venue` (test card `4242 4242 4242 4242`).
```sql
select email, terms_version, privacy_version, acceptance_surface,
       stripe_customer_id, stripe_subscription_id, stripe_price_id,
       country, region, accepted_at
from public.legal_acceptance order by created_at desc limit 5;
```
- [ ] One row: terms/privacy `V1.0`, surface `checkout`, customer/subscription/price ids present, email present
- [ ] Trigger a `customer.subscription.updated` (e.g. toggle cancel-at-period-end) → **no duplicate** row (unique key holds)
- [ ] The "By continuing, you agree to the Terms… Privacy…" line renders under the checkout button

### 3.5 Free-generation capture + child flow
Generate a song as an **adult recipient** (age ≥ 18), then a **minor** (age < 13).
```sql
select email, recipient_name, language, genre, relationship, country, region,
       target_is_minor, target_under_13, parental_consent_given,
       child_consent_version, marketing_reminder_consent, capture_version, created_at
from public.waitlist_leads order by created_at desc limit 5;
```
- [ ] Adult row: recipient/language/genre/relationship/country/region populated, `capture_version=V1.0`
- [ ] Minor flow **requires guardian confirmation** in the UI; submitting without it is blocked (403)
- [ ] Minor row: `target_under_13=true`, `child_consent_version=V1.0`, **`marketing_reminder_consent=false`**
- [ ] The optional reminder/marketing checkbox is **hidden** for the minor flow

### 3.6 Durable events
After the two generations + opening/playing/downloading/sharing a song:
```sql
select event_type, count(*) from public.generation_events
group by event_type order by event_type;
```
- [ ] Rows for server events: `generation_started`, `music_submitted`, `song_ready`, `share_created`, `download_requested`
- [ ] Rows for client events: `playback_started`, `share_click`, `share_page_view`
- [ ] `share_page_view` is logged **even when analytics consent was rejected** (first-party audit ≠ Vercel Analytics)

### 3.7 Promo permission
On the post-share card (adult flow), tick the promo checkbox. Repeat conceptually for a minor.
```sql
select granted, is_minor_recipient, share_id, permission_text_version,
       policy_version, metadata, created_at
from public.promo_permissions order by created_at desc limit 5;
```
- [ ] Adult grant → `granted=true`
- [ ] Checkbox is **not shown** for minor flows; a forced minor submission stores `granted=false` with `metadata.forced_false_minor=true`

### 3.8 Raffle (inactive by default)
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/api/raffle-entry \
  -H "Content-Type: application/json" -d '{"email":"a@b.com","raffle_opt_in":true}'
# expect 403  {"error":{"message":"No active promotion."}}
```
- [ ] Inactive → **403**, no rows written
- [ ] (Only when a promotion is intentionally launched — see §5/§4) set `ACTIVE_PROMOTION_ID`, then a valid opt-in persists to `raffle_entries`; a second identical entry returns `duplicate:true`; `marketing_consent` stays independent

### 3.9 Privacy export tooling
```bash
npm run privacy:export -- --email=<a-real-test-email-used-above>
```
- [ ] Output JSON in `privacy-exports/` collects rows across all 7 Supabase stores + resolves KV shares; only counts printed to stdout
- [ ] `npm run privacy:plan-delete -- --email=<...>` produces a `delete_plan` with `hard_delete.executed=false`
- [ ] Safe-fail confirmed: no `--email` → exit 1; `--confirm-delete` → exit 2

---

## 4. Environment variables

All set in Vercel **Production** (shared Supabase project across envs). Nothing
new is required for the compliance pack except optional promotion vars.

| Variable | Used by | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all Supabase reads/writes | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | consent/events/promo/raffle/capture inserts, export script | ✅ |
| `SUPABASE_ACCESS_TOKEN` | **migrations** (`apply-migrations.mjs` on prod build) | ✅ |
| `STRIPE_SECRET_KEY` | checkout + webhook | ✅ (existing) |
| `STRIPE_FOUNDING_VENUE_PRICE_ID` | venue checkout | ✅ (existing) |
| `STRIPE_WEBHOOK_SECRET` | webhook signature + acceptance persist | ✅ (existing) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_URL` | share storage + export KV lookups | ✅ (existing) |
| `NEXT_PUBLIC_SITE_URL` | webhook portal links | ✅ (existing) |
| `RESEND_API_KEY` | song-ready / portal / dunning emails | ✅ (existing, email path) |
| `ACTIVE_PROMOTION_ID` | server raffle activation | ❌ **leave UNSET to keep raffle inactive** |
| `NEXT_PUBLIC_ACTIVE_PROMOTION_ID` | client raffle UI gating (future) | ❌ leave unset |
| `ACTIVE_PROMOTION_PRIZE_TERMS_VERSION` | raffle prize-terms stamp | ❌ optional |
| `ANTHROPIC_*` / `SUNO_*` (lyrics/music) | full generation path only | Not needed for legal verification; **required** for §3.5–3.6 end-to-end |

- [ ] All ✅ vars present in Production
- [ ] Promotion vars **UNSET** for launch (raffle ships dormant)

---

## 5. Rollback plan

**App rollback (fastest):**
```bash
vercel ls                                   # find the previous ● Ready production deployment
vercel rollback <previous-deployment-url>   # promote the last-good build
```
Or revert the PR merge on `main` and let Vercel rebuild.

**Database:** All 7 migrations are **additive + idempotent** (`create table/column
if not exists`, guarded constraints/indexes). They add new tables/columns only —
**no destructive rollback is required**, and they do not alter or drop existing
`waitlist_leads`/`venues` data. Rolling the app back to a prior build simply
leaves the new tables unused. If you must remove an object, do it manually and
deliberately (e.g. `drop table if exists public.<name>;`) — not part of normal
rollback.

**Disable a raffle promotion:** remove the env vars and redeploy (or just clear
them — the next request reads `getActivePromotion()` live):
```bash
vercel env rm ACTIVE_PROMOTION_ID production
vercel env rm NEXT_PUBLIC_ACTIVE_PROMOTION_ID production
```
With these unset, `/api/raffle-entry` returns 403 and `/api/waitlist` writes no
raffle rows. No code change needed.

**Keep analytics off by default:** analytics is consent-gated — `<Analytics/>`
only mounts after a user grants the Analytics category. The default state (no
decision, or Reject) loads **no** Vercel Analytics. There is nothing to disable;
doing nothing keeps it off until users opt in.

---

## 6. Known limitations — carry into launch notes

- **Legal text vs PDFs:** `content/legal/*-v1.0.txt` must be confirmed verbatim
  against the approved PDFs before launch (**blocking**).
- **Hard delete / anonymization not implemented:** privacy tooling does export +
  dry-run plan only; `--confirm-delete` is intentionally rejected. Define the
  deletion/anonymization policy (esp. `venues` billing + `legal_acceptance`
  evidence retention) before building execution.
- **No stable `user_id`:** email + `anonymous_id` + `share_id` are the only join
  keys. `cookie_consent_log` is reachable **only** by `anonymous_id`.
- **KV not globally searchable:** export resolves only share ids found via
  `--share-id` or in `generation_events`/`promo_permissions`. Older shares with
  no linking row need the requester to provide the share URL/id; KV also expires
  (~90-day TTL).
- **`stripe_session_id` / `waitlist_lead_id` may be null** — captured "where
  available"; customer/subscription/email + email join cover identity.
- **`song_ready` may duplicate** occasionally (status polling); the append-only
  log tolerates it.
- **Capture fires once per session** at first lyrics generation (deduped by age
  in `sessionStorage`); edits to name/genre/relationship after that aren't
  re-sent.
- **Latent (low):** consent `policy_version` currently trusts the client-sent
  value; both are `V1.0` today. At the next policy bump, make it
  server-authoritative (`policyVersion = LEGAL_VERSION`) in `app/api/consent/route.ts`.

---

### Sign-off
- [ ] §1 pre-deploy green · [ ] §2 migrations confirmed · [ ] §3 live checks pass
- [ ] §4 env confirmed · [ ] Legal PDF sign-off · [ ] Launch notes (§6) circulated
