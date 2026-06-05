// Applies pending Supabase migrations before the production build.
//
// Wired into the Vercel build via vercel.json `buildCommand`
// ("node scripts/apply-migrations.mjs && next build"), so a deploy whose code
// expects a new column/table can never go live before the migration that adds
// it has been applied — if the migration fails, the build fails and the broken
// code is never promoted. This is the guard that would have prevented the
// /api/waitlist `target_age` outage (PGRST204 — column missing in prod).
//
// Gating: there is a SINGLE shared Supabase project across prod/preview/dev,
// so migrations are applied only on production builds. Preview/local builds
// no-op (they read the same, already-migrated schema). Override the gate with
// FORCE_DB_MIGRATE=1 if you ever need to run it outside a prod build.
//
// Required env (set in Vercel → Project → Settings → Environment Variables,
// Production scope). Provide EITHER:
//   SUPABASE_ACCESS_TOKEN  — personal access token (supabase.com/dashboard/account/tokens).
//                            RECOMMENDED: recent CLI provisions a temporary login
//                            role via the Management API ("Initialising login
//                            role..."), so NO static DB password is needed.
//                            SUPABASE_PROJECT_REF optionally overrides the ref;
//                            SUPABASE_DB_PASSWORD is optional (only used if the
//                            access-token login role is ever unavailable).
// OR:
//   SUPABASE_DB_URL        — full percent-encoded Postgres connection string for
//                            the session pooler or direct connection (port 5432,
//                            NOT the 6543 transaction pooler — DDL needs session
//                            mode). Use this only if you already have the DB
//                            password; otherwise prefer SUPABASE_ACCESS_TOKEN.
//
// Secrets are passed through the environment (never argv) so they don't leak
// into process listings or build logs.

import { spawnSync } from "node:child_process";

const DEFAULT_PROJECT_REF = "utreftnsnjbndmgezfpe"; // sing-my-birthday (not secret)

function run(args, extraEnv = {}) {
  // `npx supabase` resolves the pinned devDependency binary.
  const result = spawnSync("npx", ["--yes", "supabase", ...args], {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    console.error(`[migrate] failed to spawn supabase: ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

const vercelEnv = process.env.VERCEL_ENV ?? "(unset / local)";
const forced = process.env.FORCE_DB_MIGRATE === "1";

if (vercelEnv !== "production" && !forced) {
  console.log(
    `[migrate] VERCEL_ENV=${vercelEnv}; single shared Supabase project — skipping ` +
      `migration push (only production builds apply migrations). ` +
      `Set FORCE_DB_MIGRATE=1 to override.`,
  );
  process.exit(0);
}

const dbUrl = process.env.SUPABASE_DB_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF;

if (accessToken) {
  console.log(
    `[migrate] Production build — linking project ${projectRef} and applying pending migrations` +
      `${dbPassword ? "" : " (access-token login role, no DB password)"}…`,
  );
  // link + db push read SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD from env.
  // The DB password is optional: the CLI provisions a temporary login role from
  // the access token, so a fresh CI checkout needs only SUPABASE_ACCESS_TOKEN.
  run(["link", "--project-ref", projectRef]);
  run(["db", "push", "--linked", "--yes"]);
} else if (dbUrl) {
  console.log("[migrate] Production build — applying pending migrations via SUPABASE_DB_URL…");
  run(["db", "push", "--db-url", dbUrl, "--yes"]);
} else {
  console.error(
    "[migrate] Refusing to build production without migration credentials.\n" +
      "          Set SUPABASE_ACCESS_TOKEN (recommended — no DB password needed),\n" +
      "          or SUPABASE_DB_URL with an embedded password, in the Vercel\n" +
      "          Production environment. Failing the build so a deploy can never\n" +
      "          go live with un-applied migrations.",
  );
  process.exit(1);
}

console.log("[migrate] Migrations up to date.");
