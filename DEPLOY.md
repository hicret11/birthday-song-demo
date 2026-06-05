# Deploying

**Production deploys happen through Git. Do _not_ run `vercel --prod` from your laptop.**

The GitHub repo (`hicret11/birthday-song-demo`) is connected to the Vercel
project (`glomotec-inc/birthday-song-demo`, domain **singmybirthday.com**).

| Push to…            | Vercel builds…              |
| ------------------- | --------------------------- |
| `main`              | **Production** (singmybirthday.com) |
| any other branch    | a **Preview** deployment + PR URL   |

So the entire deploy flow is:

```
branch → open PR → review → merge to main → Vercel auto-builds & deploys production
```

## Why not `vercel --prod`?

Laptop CLI deploys are how this project drifted into an outage:

- They bypass PR review and skip the version-controlled state — for a long time
  the *entire* live app (waitlist, Stripe, the `target_age` migration, etc.)
  existed only on one laptop and was never in Git.
- Running two deploy paths in parallel (CLI + Git) is exactly how the deployed
  code and `main` silently diverge.

Converge on the Git path. If you think you need a manual deploy, you almost
certainly want a PR instead.

## Database migrations are applied automatically

The Vercel **build command** (see `vercel.json`) is:

```
node scripts/apply-migrations.mjs && next build
```

`scripts/apply-migrations.mjs` runs `supabase db push` **on production builds
only** (gated on `VERCEL_ENV === 'production'`; preview/local builds no-op since
they share the same Supabase project). If a migration fails, **the build fails**
and the code never goes live — so a deploy can never get ahead of its schema.
This is the guard that prevents a repeat of the `PGRST204 — target_age column
missing` outage.

### Adding a migration

1. Add a `.sql` file under `supabase/migrations/` (timestamp-prefixed, idempotent
   — use `if not exists` / guarded constraints).
2. Commit it in your PR alongside the code that depends on it.
3. On merge to `main`, the production build applies it **before** building the
   app. No manual `supabase db push` against prod needed.

A healthy production build logs:

```
[migrate] Production build — linking project … applying pending migrations …
Remote database is up to date.        # or: Applying migration <file>…
[migrate] Migrations up to date.
```

### Required configuration (already set)

- Vercel **Production** env var `SUPABASE_ACCESS_TOKEN` — a Supabase access
  token. The CLI provisions a temporary login role from it, so **no database
  password is needed**. (Single shared Supabase project `utreftnsnjbndmgezfpe`
  across all environments.)
- `.env.local` (gitignored) holds `SUPABASE_ACCESS_TOKEN` for the optional local
  commands below.

> Security note: prefer a **project-scoped** Supabase token over a personal
> account-wide one. To rotate: create a token at
> <https://supabase.com/dashboard/account/tokens>, then
> `vercel env rm SUPABASE_ACCESS_TOKEN production` and re-add the new value.

## Useful commands

```bash
# See what migrations would apply to prod, without applying (read-only):
npm run db:migrate:check

# Apply migrations manually (rarely needed — the prod build does this):
FORCE_DB_MIGRATE=1 npm run db:migrate     # or: supabase db push

# Watch a deployment's build logs (find the URL with `vercel ls`):
vercel inspect <deployment-url> --logs

# Roll back: promote a previous good deployment
vercel rollback <previous-deployment-url>
```

## Verifying a deploy

After a merge to `main`:

1. `vercel ls` — newest **Production** row should go `● Building` → `● Ready`.
2. `vercel inspect <url> --logs` — confirm the `[migrate]` lines ran cleanly.
3. Smoke test: `curl -i https://singmybirthday.com/` and a real generation on
   `/generate` (capture → lyrics → music → song).
