# Privacy tooling — data export & deletion plan

Internal, CLI-only tooling to **find** and **export** a user's data across all
current stores, and to produce a **dry-run deletion plan**. There is no public
UI. Hard deletion is **intentionally not implemented** in this phase.

## Run an export

```bash
npm run privacy:export -- --email=person@example.com
# with extra join keys for fuller coverage:
npm run privacy:export -- --email=person@example.com --anonymous-id=anon_… --share-id=abc123
```

Writes a structured JSON file to `privacy-exports/<timestamp>-<email>.json`
(git-ignored). Only **counts** and the output path are printed to stdout — full
PII is never logged.

## Run a deletion plan (dry-run)

```bash
npm run privacy:plan-delete -- --email=person@example.com
```

Same export, plus a `delete_plan` section listing the row ids / KV keys that a
future deletion would affect and a recommended strategy per table. **Nothing is
deleted.** `--confirm-delete` is rejected on purpose — hard delete is not
implemented yet.

## Stores covered

| Store | Matched by |
|---|---|
| Supabase `waitlist_leads` | `lower(email)` |
| Supabase `venues` | `lower(email)` |
| Supabase `legal_acceptance` | `lower(email)` |
| Supabase `cookie_consent_log` | `anonymous_id` (and `user_id` if ever set) |
| Supabase `generation_events` | `email` / `anonymous_id` / `share_id` |
| Supabase `promo_permissions` | `email` / `anonymous_id` / `share_id` |
| Supabase `raffle_entries` | `email` / `anonymous_id` |
| Vercel KV `share:{id}` | discovered share ids only (see limitations) |

## Known limitations

- **No stable `user_id`.** Email, `anonymous_id`, and `share_id` are the only
  practical join keys. Pass `--anonymous-id` and `--share-id` when known for
  fuller coverage — e.g. `cookie_consent_log` has **no email column** and is
  only reachable by `anonymous_id`.
- **KV cannot be searched globally.** Share entries are included only for share
  ids supplied via `--share-id` or discovered in `generation_events` /
  `promo_permissions` rows. Older shares with no linking row require the
  requester to provide the **share URL/id**. KV shares also expire (~90-day TTL),
  so older songs may already be gone.
- **`venues` / `legal_acceptance`** carry billing / legal-evidence linkage; the
  plan marks them `review` (anonymize / retain per policy) rather than `delete`.
- **Per-store resilience.** A failure in one store is captured under the
  `errors` array in the output rather than aborting the whole export.

## Requirements

Reads `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` and the `KV_*`
vars from `.env.production.local` / `.env.local` (never printed). No AI provider
keys are needed.
