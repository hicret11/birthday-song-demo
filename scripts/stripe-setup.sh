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
#   • Product "Sing My Birthday — Full Song" with 6 one-time prices
#       full   A/B/C = $9.99 / $5.99 / $2.99   → STRIPE_PRICE_ID_TIER_A/B/C
#       deluxe A/B/C = $14.99 / $9.99 / $5.99  → STRIPE_PRICE_ID_DELUXE_A/B/C
#   • Product "Sing My Birthday — Founding Venue" with 1 recurring price
#       $299 / month                            → STRIPE_FOUNDING_VENUE_PRICE_ID
#   • A webhook endpoint at $SITE_URL/api/stripe/webhook subscribing to the 5
#     events the app handles                    → STRIPE_WEBHOOK_SECRET
#
# At the end it prints the exact env block to paste into Vercel (Production).
#
# ── Usage ────────────────────────────────────────────────────────────────────
#   export STRIPE_API_KEY=sk_test_...        # rehearse first
#   export SITE_URL=https://singmybirthday.com
#   bash scripts/stripe-setup.sh
#
#   # then, to actually go live:
#   export STRIPE_API_KEY=sk_live_...
#   bash scripts/stripe-setup.sh
#
# No `stripe login` needed — the key is passed per-call via --api-key, so your
# CLI's stored session is never used and can't put you in the wrong account.

set -euo pipefail

KEY="${STRIPE_API_KEY:-}"
SITE_URL="${SITE_URL:-}"

[ -n "$KEY" ]     || { echo "✗ Set STRIPE_API_KEY (sk_test_… to rehearse, sk_live_… to go live)"; exit 1; }
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
PRICE_TIER_A=$(find_or_create_price smb_song_full_a   "$SONG_PROD"  999 "Full — Tier A ($9.99)")
PRICE_TIER_B=$(find_or_create_price smb_song_full_b   "$SONG_PROD"  599 "Full — Tier B ($5.99)")
PRICE_TIER_C=$(find_or_create_price smb_song_full_c   "$SONG_PROD"  299 "Full — Tier C ($2.99)")
PRICE_DLX_A=$(find_or_create_price  smb_song_deluxe_a "$SONG_PROD" 1499 "Deluxe — Tier A ($14.99)")
PRICE_DLX_B=$(find_or_create_price  smb_song_deluxe_b "$SONG_PROD"  999 "Deluxe — Tier B ($9.99)")
PRICE_DLX_C=$(find_or_create_price  smb_song_deluxe_c "$SONG_PROD"  599 "Deluxe — Tier C ($5.99)")

echo "→ Venue product + subscription price…"
VENUE_PROD=$(find_or_create_product \
  "Sing My Birthday — Founding Venue" \
  "Founding-venue monthly subscription: branded venue page and included songs.")
VENUE_PRICE=$(find_or_create_price smb_founding_venue "$VENUE_PROD" 29900 "Founding Venue ($299/mo)" month)

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
echo "STRIPE_FOUNDING_VENUE_PRICE_ID=$VENUE_PRICE"
echo "════════════════════════════════════════════════════════════════════"
echo "Done. In LIVE mode also confirm the webhook shows the 5 events in the"
echo "Dashboard, and that STRIPE_SECRET_KEY above is your live key."
