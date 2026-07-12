// Launch (intro) discount — a reversible, brand-safe way to lower the *effective*
// price during launch without permanently anchoring the base price low.
//
// Rationale (Rosa's launch thesis): an unknown brand needs low trial friction to
// earn the first word-of-mouth wave, but the base price should stay put so we can
// (a) never look like we "raised prices" on early fans, and (b) tell a real
// gift-worthy price story. A launch *discount* threads that needle: the base
// labels in lib/pricing-display never change, we just strike them through and
// show a lower number while the promo runs. Ending the promo = the strikethrough
// disappears; nothing ever reads as an increase.
//
// ONE knob drives both the display and the charge: NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT
// (e.g. "50"). It's NEXT_PUBLIC so the paywall (client) and the checkout route
// (server) read the same value. Because NEXT_PUBLIC vars are inlined into the
// client bundle at build time, changing it takes effect on the next deploy —
// treat "start/stop the launch" as a redeploy, not a live env toggle.
//
// Pure + dependency-free (no Stripe import) so it's safe in client components.
// The checkout route turns `launchDiscountPercent()` into an actual Stripe
// coupon at charge time; see app/api/stripe/checkout-song.

const RAW_PERCENT = process.env.NEXT_PUBLIC_LAUNCH_DISCOUNT_PERCENT;

/**
 * The active launch discount as an integer percent in [0, 90]. 0 means "off".
 * Capped at 90 so a launch discount can never accidentally make a song free
 * (100% off) — comps go through the email allowlist / promo code instead.
 */
export function launchDiscountPercent(): number {
  const n = Math.floor(Number(RAW_PERCENT));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 90);
}

/** True when a launch discount is in effect. */
export function isLaunchActive(): boolean {
  return launchDiscountPercent() > 0;
}

/**
 * Deterministic Stripe coupon id for a given percent, e.g. "launch-50pct". The
 * checkout route retrieves-or-creates this coupon so no manual Stripe setup or
 * extra env var is needed — the percent alone defines everything.
 */
export function launchCouponId(percent: number = launchDiscountPercent()): string {
  return `launch-${percent}pct`;
}

/** Parse a "$14.99"-style USD label to integer cents, or null if not that shape. */
function labelToCents(label: string): number | null {
  const m = /\$\s*(\d+)(?:\.(\d{1,2}))?/.exec(label);
  if (!m) return null;
  const dollars = Number(m[1]);
  const cents = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return dollars * 100 + cents;
}

function centsToLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type LaunchView = {
  active: boolean;
  /** The original (struck-through when active) label, unchanged. */
  original: string;
  /** The price to actually show/charge — discounted when active, else original. */
  discounted: string;
  percent: number;
};

/**
 * Launch view of a base price label. When the launch is off (or the label isn't
 * a parseable USD amount) `active` is false and `discounted === original`, so
 * callers can render/consume it unconditionally without branching.
 */
export function launchView(label: string): LaunchView {
  const percent = launchDiscountPercent();
  const base = labelToCents(label);
  if (percent <= 0 || base == null) {
    return { active: false, original: label, discounted: label, percent: 0 };
  }
  const discounted = Math.round((base * (100 - percent)) / 100);
  return { active: true, original: label, discounted: centsToLabel(discounted), percent };
}
