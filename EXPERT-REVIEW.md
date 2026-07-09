# Pre-Launch Expert Review — Sing My Birthday

**Date:** 2026-07-10 · **Branch:** `feat/deliverable-rebuild` · **Reviewed build:** post-redesign preview
**Method:** Product run locally (SSO bypassed), Chromium-driven capture of the full funnel at
desktop 1440 + mobile 375, light + dark. Five independent adversarial experts reviewed the
real rendered screens + code. Screenshots in `design-review/review/`.

**Funnel covered:** landing → /generate casting intake → premiere reveal (closed + open) →
paywall / 3 tiers → recipient share page → countdown "premiere ticket" → cast/AI-call add-on →
venue partner page → SEO happy-birthday page → login. (Onboarding is a private post-Stripe
flow that 307-redirects without a session — reviewed as code, not a public screen.)

---

## Launch-readiness verdict (one paragraph)

The calm/warm redesign is **fundamentally sound and close to launch** — hierarchy is confident,
the one-world system is coherent, and the cinematic guardrail is honored beautifully (the reveal
and countdown ticket are genuine highlights). But it is **not launch-ready as-is**: four issues
sit directly on the money-and-trust path. (1) The paywall steers buyers to the *lowest* tier —
the default selection and checkout CTA lock to Standard while the "Most chosen" badge sits on
Deluxe, actively costing revenue on every sale. (2) The emotional peak breaks for common long
names — the recipient's name is uncapped and rendered at a fixed non-wrapping 44px, so
"Christopher"/"Alexandra" overflow the reveal card on mobile. (3) The first screen of the paid
funnel shows a disabled CTA that reads as *broken* in dark mode. (4) The recipient's first
impression is a generic "✨ It's Your Special Day!" badge that deflates the premium premiere. All
four are cheap, visual/copy-only fixes. Fix the P0s + cheap P1s below and this ships.

---

## Merged prioritized decision list

Legend: **✅ = fixing now** (this pass) · **📌 = deferred with owner note** · cost in brackets.

### P0 — must fix before launch
| # | Decision | Where | Sources |
|---|----------|-------|---------|
| P0-1 ✅ | **Default paywall selection → Deluxe** so the selection ring, "Most chosen" badge, and checkout CTA all agree; give Deluxe visible body + promote the badge. Stops hand-delivering the floor price. `[cheap]` | `UnlockableAudio.tsx:62`, generate step-3 paywall | CRO-1, CRO-2, CRO-3, UX-2 |
| P0-2 ✅ | **Fix disabled /generate CTA** — replace transparent ghost with a visible muted fill so it reads "waiting for input," never "broken" (critical in dark mode). `[trivial]` | `GeneratorClient.tsx:2396` (+siblings) | UX-1 |
| P0-3 ✅ | **Stop the reveal name overflowing** — fluid `clamp()` font + `break-words` on the star `<h1>`; add `maxLength` to the recipient-name input. `[cheap]` | `PremiereReveal.tsx:419`, `GeneratorClient.tsx:2300` | QA-1 |
| P0-4 ✅ | **Replace the generic "✨ It's Your Special Day!" badge** at the recipient's first impression with an on-voice unified line across all 4 templates. `[trivial]` | `Classic/Elegant/Neon/Playful.tsx` | copy-1 |

### P1 — fix now (cheap) unless noted
| # | Decision | Where | Sources |
|---|----------|-------|---------|
| P1-1 ✅ | **Stale product name** "Made with Birthday Song Generator" → "Made with love by Sing My Birthday". `[trivial]` | `templates/shared.tsx:466` | copy-2 |
| P1-2 ✅ | **Add a branded 404** (`app/not-found.tsx`) — expired/mistyped share links (shares have a 90-day TTL) currently hit the raw Next default. Warm shell + logo + "Make a birthday song" CTA. `[cheap]` | new `app/not-found.tsx` | QA-2 |
| P1-3 ✅ | **One primary action on the share page** — demote the co-equal jade "Send to a friend / Try another version / Make your own" buttons so only unlock is solid jade. `[cheap]` | `templates/shared.tsx` | UX-3, CRO-4 |
| P1-4 ✅ | **Thin the curtain metaphor at the paywall** — "raise the curtain" appears 3×, "premiere" 2× in one viewport. Reserve the metaphor for the button; make the value line plain. `[cheap]` | `en.ts:300-303` | copy-3, UX-4 |
| P1-5 ✅ | **Beat labels** — drop redundant "— the X" tails; `Act 1 · Casting` / `Act 2 · Direction` stand alone. `[cheap]` | `en.ts:212-263` | copy-4 |
| P1-6 ✅ | **Strengthen money-back at the paywall** — "Love it or your money back" → "Love it, or it's free" to match the hero verbatim. `[trivial]` | `en.ts:327` | copy-5, FT-4 |
| P1-7 ✅ | **Company identity in footer** — add "© 2026 Sing My Birthday · info@singmybirthday.com" (address already used elsewhere). `[cheap]` | `SiteFooter.tsx` | FT-3 |
| P1-8 ✅ | **Guillemets typo** — «{title}» renders as foreign typography in English and triples the title on the reveal. Remove it. `[trivial]` | `PremiereReveal.tsx:433` | copy-6 |
| P1-9 ✅ | **Disambiguate the AI-call copy** — "in their own voice" reads creepy/ambiguous (voice-cloning?). → "in the character's voice". `[cheap]` | `en.ts:320,333,476` | FT-5 |
| P1-10 ✅ | **"THE PRODUCTION STUDIO"** caps label reads as a broken nav link on mobile and crowds the logo — hide on mobile / demote to non-interactive tag. `[trivial]` | `GeneratorClient.tsx` header | UX-5 |
| P1-11 ✅ | **Gate /premiere out of production** — internal reveal preview returns 200 publicly and serves a 2.1MB dev `/_test` sample; `notFound()` in prod. `[cheap]` | `app/premiere/page.tsx` | QA-3 |
| P1-12 ✅ | **Unify share verb** — "Send to a friend" → "Send it to them 💌" (matches the reveal's own CTA, on-voice). `[trivial]` | `templates/shared.tsx` | copy-8 |
| P1-13 📌 | **Landing hero "player" is decorative and never plays** — undermines "hear it before you pay." Wants a *real* hosted ~15s demo clip. Deferred: needs a real audio asset from the founder (won't ship a fake or a dev sample). Owner: founder to supply demo MP3. | `app/page.tsx:203` | FT-2 |
| P1-14 📌 | **Zero social proof anywhere** at the point of payment. Can't fabricate — needs real testimonials + a real "songs made" count from the launch cohort. Owner: collect from first cohort, then surface 3 quotes on landing + 1 line at paywall. | landing, paywall | FT-1 |

### P2 — folding in the cheap/safe ones now; rest noted
| # | Decision | Where | Sources |
|---|----------|-------|---------|
| P2-1 ✅ | **Risk-reversal above the fold** — add the money-back line under the hero CTA (best objection-killer currently buried mid-page). `[cheap]` | `app/page.tsx` hero | CRO-6 |
| P2-2 ✅ | **forced-colors fallback** for the gradient star name (can render invisible in Windows High-Contrast). `[trivial]` | `PremiereReveal.tsx` | QA-4 |
| P2-3 ✅ | **Validate the SEO name param** — `/happy-birthday/<junk>` renders an embarrassing page + pollutes canonical/OG. Validate + `notFound()`. `[cheap]` | `app/happy-birthday/[name]/page.tsx` | QA-6 |
| P2-4 ✅ | **Contrast** — swap small/body-weight jade text on cream (~3.16:1, fails AA) to `jade-deep` (~5.2:1) in the clearest spots; leave white-on-jade CTAs. `[cheap]` | targeted | QA-5 |
| P2-5 📌 | Orphaned `en.ts` landing keys (hero/how/faq) diverge from the hardcoded landing — dead copy, two sources of truth. Deferred: dead-code cleanup, minor i18n-type risk; not user-visible. | `en.ts:8-56` | copy-7 |
| P2-6 📌 | **Onboarding coverage gap** — private post-Stripe flow (307-redirects without a session); reviewed as code, not capturable without a live checkout. Owner: eyeball once post-launch with a real session. | `app/onboarding` | UX-6 |
| P2-7 ✅ | **Honest urgency** — a birthday is a real deadline; add one honest deadline-framed line near a CTA (no fake countdowns). `[cheap]` | landing/paywall | CRO-7 |

---

## Each role's verdict (bottom line)

- **Senior Product / UX Designer:** Close, not there. Redesign holds on landing/share/reveal;
  dark mode mostly survives. Blocker = the disabled CTA reading as broken on funnel entry;
  secondary = the paywall's selection/badge/CTA disagreement and too many co-equal CTAs.
- **Conversion / Growth (CRO):** Not launch-ready in-lane. Pricing presentation steers to the
  lowest-revenue tier (default + CTA on Standard, badge on Deluxe); value ladder visually
  inverted; secondary CTAs and the buried ~$120 anchor leak intent. All in-scope copy/default
  fixes.
- **Brand & Copywriter:** Not launch-ready, but every blocker is a cheap edit. The theatrical
  voice is strong at the peaks; it collides with leftover generic copy exactly where it matters
  (the "Special Day" badge and the stale old product name on the recipient page).
- **First-time-visitor / Trust:** No hard blocker — real free preview + money-back + Stripe +
  legal links are a genuine trust core. But the scaffolding a cold stranger needs is thin: no
  social proof, no company identity on consumer surfaces, and a decorative hero player that
  never plays.
- **QA / Launch-readiness:** Not launch-ready. Two must-fix on the trust path: the reveal name
  overflows for common long names (uncapped input + fixed 44px), and there's no branded 404 for
  the product's core distribution mechanism (share links). Rest is polish (contrast, forced
  colors, SEO-name validation, gating the /premiere dev surface).

---

## What was decided NOT to do (and why)
- **No fabricated social proof / no fake reviews or counts** — off-limits and legally risky.
  Deferred to real launch-cohort data (P1-14).
- **No wiring the hero player to a dev/`_test` clip** — shipping placeholder media as "the
  product's proof" is worse than an honest static card. Needs a real demo (P1-13).
- **No prices/paywall-mechanics/backend/flow/i18n-behavior changes** — per constraints. Every
  fix above is visual, copy, or presentation only. Pricing *presentation* (default selection,
  badge, ordering, labels) is in scope; the Stripe prices themselves are untouched.
- **No new features, no gold-plating** — this pass only fixes and polishes toward launch.
