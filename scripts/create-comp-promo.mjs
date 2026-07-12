// Create a 100%-off promotion code for comping song unlocks.
//
// The consumer checkout (app/api/stripe/checkout-song) already sets
// `allow_promotion_codes: true`, so the ONLY missing piece for the promo-code
// path is a coupon + promotion code in Stripe. This script creates:
//   • a reusable 100%-off coupon (once), and
//   • a promotion code on it (default code: ADMINCOMP — override with PROMO_CODE).
//
// Runs against whatever STRIPE_SECRET_KEY points at, so double-check you're on
// the account you intend (this is usually your LIVE key). Re-running is safe:
// it finds the existing coupon by name and skips duplicate codes.
//
//   node scripts/create-comp-promo.mjs
//   PROMO_CODE=TEAMFREE MAX_REDEMPTIONS=50 node scripts/create-comp-promo.mjs
//
// Give the resulting code to an admin; they enter it at the paywall's
// "Add promotion code" field and the unlock is free. Unlike the email
// allowlist, a code is not tied to an identity — set MAX_REDEMPTIONS and/or
// EXPIRES_DAYS to contain leakage, and delete/deactivate it in the Dashboard
// when you're done.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set. Export it (or source your env) and retry.");
  process.exit(1);
}

const stripe = new Stripe(key);

const COUPON_NAME = "Admin comp — 100% off song unlock";
const CODE = (process.env.PROMO_CODE || "ADMINCOMP").toUpperCase();
const MAX_REDEMPTIONS = process.env.MAX_REDEMPTIONS ? Number(process.env.MAX_REDEMPTIONS) : undefined;
const EXPIRES_DAYS = process.env.EXPIRES_DAYS ? Number(process.env.EXPIRES_DAYS) : undefined;

async function findOrCreateCoupon() {
  // Reuse an existing comp coupon (by name) so re-runs don't pile up coupons.
  for await (const c of stripe.coupons.list({ limit: 100 })) {
    if (c.name === COUPON_NAME && c.percent_off === 100 && c.valid) return c;
  }
  const coupon = await stripe.coupons.create({
    name: COUPON_NAME,
    percent_off: 100,
    duration: "once", // applies to the single one-time unlock payment
  });
  console.log(`Created coupon ${coupon.id} (100% off).`);
  return coupon;
}

async function main() {
  const coupon = await findOrCreateCoupon();

  // If this exact code already exists, don't try to recreate it.
  const existing = await stripe.promotionCodes.list({ code: CODE, limit: 1 });
  if (existing.data.length > 0) {
    const pc = existing.data[0];
    console.log(`Promotion code "${CODE}" already exists (${pc.id}, active=${pc.active}). Nothing to do.`);
    return;
  }

  // API version 2026-04-22.dahlia nests the coupon under `promotion` (the old
  // top-level `coupon` param was removed).
  const params = { promotion: { type: "coupon", coupon: coupon.id }, code: CODE };
  if (Number.isFinite(MAX_REDEMPTIONS)) params.max_redemptions = MAX_REDEMPTIONS;
  if (Number.isFinite(EXPIRES_DAYS)) {
    params.expires_at = Math.floor(Date.now() / 1000) + EXPIRES_DAYS * 24 * 60 * 60;
  }

  const promo = await stripe.promotionCodes.create(params);
  console.log("");
  console.log(`✅ Promotion code created: ${promo.code}  (${promo.id})`);
  console.log(`   coupon: ${coupon.id} (100% off, once)`);
  if (params.max_redemptions) console.log(`   max redemptions: ${params.max_redemptions}`);
  if (params.expires_at) console.log(`   expires: ${new Date(params.expires_at * 1000).toISOString()}`);
  console.log("");
  console.log(`Share "${promo.code}" with an admin; they enter it at the paywall's promotion-code field.`);
}

main().catch((err) => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});
