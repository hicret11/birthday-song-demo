#!/usr/bin/env bash
#
# Push the Stripe env vars from stripe-live-env.txt into Vercel.
#
# Reads each value from the scratch file and sets it on the target Vercel
# environment(s), OVERWRITING any existing value (remove-then-add), so a fresh
# webhook secret or rotated key replaces the old one cleanly. Prints variable
# NAMES only — never the values.
#
# ── Usage ────────────────────────────────────────────────────────────────────
#   bash scripts/vercel-env-push.sh                 # → Production only
#   VERCEL_ENV_TARGETS="production preview" bash scripts/vercel-env-push.sh
#
# Requires: the project already linked (vercel link) and you logged in
# (vercel whoami). After it runs, trigger a redeploy so the new env takes effect.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../stripe-live-env.txt"
TARGETS="${VERCEL_ENV_TARGETS:-production}"   # space-separated list

[ -f "$ENV_FILE" ]                 || { echo "✗ $ENV_FILE not found"; exit 1; }
command -v vercel >/dev/null 2>&1  || { echo "✗ vercel CLI not found"; exit 1; }

VARS="
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_TIER_A
STRIPE_PRICE_ID_TIER_B
STRIPE_PRICE_ID_TIER_C
STRIPE_PRICE_ID_DELUXE_A
STRIPE_PRICE_ID_DELUXE_B
STRIPE_PRICE_ID_DELUXE_C
STRIPE_FOUNDING_VENUE_PRICE_ID
"

fail=0
for name in $VARS; do
  value="$(grep -E "^$name=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')"
  if [ -z "$value" ]; then
    echo "⚠  $name — empty in $ENV_FILE, skipped"; fail=1; continue
  fi
  for env in $TARGETS; do
    vercel env rm "$name" "$env" -y >/dev/null 2>&1 || true    # overwrite if present
    if printf '%s' "$value" | vercel env add "$name" "$env" >/dev/null 2>&1; then
      echo "→ set $name  [$env]"
    else
      echo "✗ failed $name  [$env]"; fail=1
    fi
  done
done

echo
if [ "$fail" -eq 0 ]; then
  echo "✓ All Stripe vars pushed. Verify:  vercel env ls | grep STRIPE"
  echo "  Then redeploy so it takes effect:  vercel --prod"
  echo "  And remove the local secrets file:  rm stripe-live-env.txt"
else
  echo "⚠  Some vars were skipped/failed — check the lines above."
fi
