#!/usr/bin/env bash
#
# Stripe products + prices + webhook setup for Sing My Birthday.
#
# Idempotent and mode-agnostic: the mode (TEST vs LIVE) is decided ENTIRELY by
# which secret key you export. Rehearse against TEST first, then run again with
# your live key to go live. Prices are keyed by Stripe `lookup_key`, so re-runs
# reuse the existing price instead of creating duplicates.
#
# It creates:
#   • Product "Sing My Birthday — Full Song" with 9 one-time prices
#       full       A/B/C = $14.99 / $9.99 / $6.99    → STRIPE_PRICE_ID_TIER_A/B/C
#       deluxe     A/B/C = $24.99 / $16.99 / $11.99  → STRIPE_PRICE_ID_DELUXE_A/B/C
#       production A/B/C = $44.99 / $29.99 / $21.99  → STRIPE_PRICE_ID_PRODUCTION_A/B/C
#   • Product "Sing My Birthday — Founding Venue" with 1 recurring price
#       $299 / month                            → STRIPE_FOUNDING_VENUE_PRICE_ID
#   • A webhook endpoint at $SITE_URL/api/stripe/webhook subscribing to the 5
#     events the app handles                    → STRIPE_WEBHOOK_SECRET
#
# At the end it prints the exact env block to paste into Vercel (Production).
#
# ── Usage ────────────────────────────────────────────────────────────────────
# Simplest: put STRIPE_SECRET_KEY=sk_live_... in stripe-live-env.txt, then just:
#   bash scripts/stripe-setup.sh          # LIVE run → type LIVE to confirm
# The script reads the key from that file, and writes every result (price ids +
# webhook secret) BACK into the same file, so it self-fills for pasting into Vercel.
#
# Or drive it entirely from the environment (SITE_URL defaults to the prod domain):
#   export STRIPE_API_KEY=sk_test_...     # sk_test_ to rehearse, sk_live_ to go live
#   export SITE_URL=https://singmybirthday.com
#   bash scripts/stripe-setup.sh
#
# No `stripe login` needed — the key is passed per-call via --api-key, so your
# CLI's stored session is never used and can't put you in the wrong account.

set -euo pipefail

# Resolve the repo-root env scratch file (holds the key + gets the results
# written back into it). Located relative to this script, not the caller's cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../stripe-live-env.txt"

# Key: prefer the exported env var; otherwise read STRIPE_SECRET_KEY from the
# scratch file so you can just paste the key there and run this with no exports.
KEY="${STRIPE_API_KEY:-}"
if [ -z "$KEY" ] && [ -f "$ENV_FILE" ]; then
  KEY="$(grep -E '^STRIPE_SECRET_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')"
fi
# SITE_URL: exported value wins, else the production default.
SITE_URL="${SITE_URL:-https://singmybirthday.com}"

[ -n "$KEY" ]     || { echo "✗ No key. Export STRIPE_API_KEY, or put STRIPE_SECRET_KEY= in $ENV_FILE"; exit 1; }
[ -n "$SITE_URL" ] || { echo "✗ Set SITE_URL (e.g. https://singmybirthday.com)"; exit 1; }
command -v stripe >/dev/null || { echo "✗ Stripe CLI not found — https://stripe.com/docs/stripe-cli"; exit 1; }
command -v node   >/dev/null || { echo "✗ node not found (used to parse JSON)"; exit 1; }

case "$KEY" in
  sk_live_*) MODE="LIVE" ;;
  sk_test_*|rk_test_*) MODE="TEST" ;;
  *) echo "✗ STRIPE_API_KEY must start with sk_live_ or sk_test_"; exit 1 ;;
esac

WEBHOOK_URL="${SITE_URL%/}/api/stripe/webhook"
echo "── Stripe setup ─────────────────────────────────────────"
echo "   mode:    $MODE"
echo "   webhook: $WEBHOOK_URL"
echo "─────────────────────────────────────────────────────────"

if [ "$MODE" = "LIVE" ]; then
  printf '⚠  This creates REAL, LIVE payment objects on your Stripe account.\n   Type LIVE to proceed: '
  read -r confirm
  [ "$confirm" = "LIVE" ] || { echo "Aborted."; exit 1; }
fi

sc() { stripe "$@" --api-key "$KEY" 2>/dev/null; }

# Extract a dotted path (supports array indices) from JSON on stdin.
field() {
  node -e '
    const p=process.argv[1];let s="";
    process.stdin.on("data",d=>s+=d).on("end",()=>{
      try{let o=JSON.parse(s);for(const k of p.split("."))o=(o==null?undefined:o[k]);console.log(o==null?"":o);}
      catch{console.log("");}
    });' "$1"
}

# Fill KEY=VALUE into $ENV_FILE in place (replace the empty placeholder, or
# append if absent), preserving the file's comments. Values are Stripe ids /
# secrets — all [A-Za-z0-9_], so a '|' sed delimiter is always safe. No-op if
# the value is empty (e.g. webhook secret unavailable on a pre-existing endpoint).
setvar() {
  local key="$1" val="$2"
  [ -n "$val" ] || return 0
  [ -f "$ENV_FILE" ] || return 0
  if grep -qE "^$key=" "$ENV_FILE"; then
    sed -i.bak "s|^$key=.*|$key=$val|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "$key=$val" >> "$ENV_FILE"
  fi
}

# Find an active product by exact name, else create it. Echoes the product id.
find_or_create_product() {
  local name="$1" desc="$2" existing
  existing=$(sc products list -d "limit=100" | node -e '
    const n=process.argv[1];let s="";
    process.stdin.on("data",d=>s+=d).on("end",()=>{
      try{const o=JSON.parse(s);const p=(o.data||[]).find(x=>x.name===n&&x.active);console.log(p?p.id:"");}
      catch{console.log("");}
    });' "$name")
  if [ -n "$existing" ]; then echo "$existing"; return; fi
  sc products create -d "name=$name" -d "description=$desc" | field id
}

# Find a price by lookup_key, else create it. Echoes the price id.
# Args: lookup_key product amount_cents nickname [recurring_interval]
find_or_create_price() {
  local lk="$1" product="$2" amount="$3" nick="$4" interval="${5:-}" existing
  existing=$(sc prices list -d "lookup_keys[]=$lk" -d "limit=1" | field data.0.id)
  if [ -n "$existing" ]; then echo "$existing"; return; fi
  if [ -n "$interval" ]; then
    sc prices create -d "product=$product" -d "currency=usd" -d "unit_amount=$amount" \
      -d "recurring[interval]=$interval" -d "lookup_key=$lk" -d "nickname=$nick" | field id
  else
    sc prices create -d "product=$product" -d "currency=usd" -d "unit_amount=$amount" \
      -d "lookup_key=$lk" -d "nickname=$nick" | field id
  fi
}

echo "→ Song product…"
SONG_PROD=$(find_or_create_product \
  "Sing My Birthday — Full Song" \
  "Unlock the full personalized birthday song + MP3 download, share video, and photo slideshow.")
[ -n "$SONG_PROD" ] || { echo "✗ could not create/find song product"; exit 1; }

echo "→ Song prices…"
PRICE_TIER_A=$(find_or_create_price smb_song_full_a_v2   "$SONG_PROD" 1499 'Full — Tier A ($14.99)')
PRICE_TIER_B=$(find_or_create_price smb_song_full_b_v2   "$SONG_PROD"  999 'Full — Tier B ($9.99)')
PRICE_TIER_C=$(find_or_create_price smb_song_full_c_v2   "$SONG_PROD"  699 'Full — Tier C ($6.99)')
PRICE_DLX_A=$(find_or_create_price  smb_song_deluxe_a_v2 "$SONG_PROD" 2499 'Deluxe — Tier A ($24.99)')
PRICE_DLX_B=$(find_or_create_price  smb_song_deluxe_b_v2 "$SONG_PROD" 1699 'Deluxe — Tier B ($16.99)')
PRICE_DLX_C=$(find_or_create_price  smb_song_deluxe_c_v2 "$SONG_PROD" 1199 'Deluxe — Tier C ($11.99)')
# Production ("Full Production") — Deluxe + the AI character birthday call.
# New _v3 lookup keys (prices are immutable — never mutate existing ones).
PRICE_PROD_A=$(find_or_create_price smb_song_production_a_v3 "$SONG_PROD" 4499 'Full Production — Tier A ($44.99)')
PRICE_PROD_B=$(find_or_create_price smb_song_production_b_v3 "$SONG_PROD" 2999 'Full Production — Tier B ($29.99)')
PRICE_PROD_C=$(find_or_create_price smb_song_production_c_v3 "$SONG_PROD" 2199 'Full Production — Tier C ($21.99)')

echo "→ Venue product + subscription price…"
VENUE_PROD=$(find_or_create_product \
  "Sing My Birthday — Founding Venue" \
  "Founding-venue monthly subscription: branded venue page and included songs.")
VENUE_PRICE=$(find_or_create_price smb_founding_venue "$VENUE_PROD" 29900 'Founding Venue ($299/mo)' month)

echo "→ Webhook endpoint…"
EXISTING_WH=$(sc webhook_endpoints list -d "limit=100" | node -e '
  const u=process.argv[1];let s="";
  process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const o=JSON.parse(s);const w=(o.data||[]).find(x=>x.url===u);console.log(w?w.id:"");}
    catch{console.log("");}
  });' "$WEBHOOK_URL")

WEBHOOK_SECRET=""
if [ -n "$EXISTING_WH" ]; then
  echo "   endpoint already exists ($EXISTING_WH) — its signing secret is only shown at"
  echo "   creation time. Reuse the STRIPE_WEBHOOK_SECRET you already saved, or roll it in"
  echo "   the Dashboard (Developers → Webhooks → this endpoint → Roll secret)."
else
  WH_JSON=$(sc webhook_endpoints create \
    -d "url=$WEBHOOK_URL" \
    -d "enabled_events[]=checkout.session.completed" \
    -d "enabled_events[]=customer.subscription.created" \
    -d "enabled_events[]=customer.subscription.updated" \
    -d "enabled_events[]=customer.subscription.deleted" \
    -d "enabled_events[]=invoice.payment_failed")
  WEBHOOK_SECRET=$(echo "$WH_JSON" | field secret)
fi

echo
echo "════════════════════════════════════════════════════════════════════"
echo " $MODE env — paste into Vercel (Project → Settings → Env, Production)"
echo "════════════════════════════════════════════════════════════════════"
echo "STRIPE_SECRET_KEY=$KEY"
[ -n "$WEBHOOK_SECRET" ] && echo "STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET" || echo "STRIPE_WEBHOOK_SECRET=<reuse existing / roll in Dashboard>"
echo "STRIPE_PRICE_ID_TIER_A=$PRICE_TIER_A"
echo "STRIPE_PRICE_ID_TIER_B=$PRICE_TIER_B"
echo "STRIPE_PRICE_ID_TIER_C=$PRICE_TIER_C"
echo "STRIPE_PRICE_ID_DELUXE_A=$PRICE_DLX_A"
echo "STRIPE_PRICE_ID_DELUXE_B=$PRICE_DLX_B"
echo "STRIPE_PRICE_ID_DELUXE_C=$PRICE_DLX_C"
echo "STRIPE_PRICE_ID_PRODUCTION_A=$PRICE_PROD_A"
echo "STRIPE_PRICE_ID_PRODUCTION_B=$PRICE_PROD_B"
echo "STRIPE_PRICE_ID_PRODUCTION_C=$PRICE_PROD_C"
echo "STRIPE_FOUNDING_VENUE_PRICE_ID=$VENUE_PRICE"
echo "════════════════════════════════════════════════════════════════════"

# Write the results straight back into the scratch file so it self-fills — you
# just open it and copy into Vercel. STRIPE_SECRET_KEY is already there; we fill
# the webhook secret (if freshly created) and the 10 price ids.
setvar STRIPE_WEBHOOK_SECRET        "$WEBHOOK_SECRET"
setvar STRIPE_PRICE_ID_TIER_A       "$PRICE_TIER_A"
setvar STRIPE_PRICE_ID_TIER_B       "$PRICE_TIER_B"
setvar STRIPE_PRICE_ID_TIER_C       "$PRICE_TIER_C"
setvar STRIPE_PRICE_ID_DELUXE_A     "$PRICE_DLX_A"
setvar STRIPE_PRICE_ID_DELUXE_B     "$PRICE_DLX_B"
setvar STRIPE_PRICE_ID_DELUXE_C     "$PRICE_DLX_C"
setvar STRIPE_PRICE_ID_PRODUCTION_A "$PRICE_PROD_A"
setvar STRIPE_PRICE_ID_PRODUCTION_B "$PRICE_PROD_B"
setvar STRIPE_PRICE_ID_PRODUCTION_C "$PRICE_PROD_C"
setvar STRIPE_FOUNDING_VENUE_PRICE_ID "$VENUE_PRICE"
[ -f "$ENV_FILE" ] && echo "→ Filled $ENV_FILE — open it and copy the values into Vercel."

echo "Done. In LIVE mode also confirm the webhook shows the 5 events in the"
echo "Dashboard, and that STRIPE_SECRET_KEY above is your live key."
