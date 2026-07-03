# Sing My Birthday — Go-Live Checklist

Status as of this session: **P0 code written, statically verified (tsc + unit tests), and the audio pipeline validated end-to-end against real ffmpeg.** Remaining items below are infrastructure/config that must be done on real accounts + a full build/e2e pass on proper CI (the sandbox CPU can't finish a Turbopack build).

---

## 0. Verified this session ✅
- `npx tsc --noEmit` → clean.
- `npm test` (vitest) → 13/13 pass (geo tiers, Deluxe price fallback, paywall URL stripping).
- Live ffmpeg smoke on a real 185s mp3 → highlight cut **55.0s**, preview **15.0s**, full **185s**, legacy preview path **15s**.
- **Bug caught + fixed:** `@ffmpeg-installer` ships ffmpeg but **not ffprobe**, so `probeDuration` returned 0 and the highlight-cut would have been silently disabled in production. Duration is now read from ffmpeg's own output (with an assumed-long fallback), so the cut always runs.

## 1. Must run on real CI / Vercel (not done here)
- [ ] `npm run build` on Vercel/CI — confirm a clean production build (sandbox CPU couldn't complete it).
- [ ] One real end-to-end purchase on a Stripe **test** key: generate → preview (15s only) → checkout → webhook unlock → full song + video + (Deluxe) slideshow + full-length download.
- [ ] Verify a **locked** share leaks no full media: open the share page, inspect page source + network — only `/api/share/[id]/preview` should be reachable; `/download` returns 402.

## 2. Stripe (consumer one-time payments)
- [ ] Create Product "Sing My Birthday — Full Song" with 6 one-time prices; set env:
  - `STRIPE_PRICE_ID_TIER_A` ($9.99) / `_TIER_B` ($5.99) / `_TIER_C` ($2.99)
  - `STRIPE_PRICE_ID_DELUXE_A` ($14.99) / `_DELUXE_B` ($9.99) / `_DELUXE_C` ($5.99)
- [ ] `STRIPE_SECRET_KEY` (live) + webhook endpoint subscribed to `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`.
- [ ] Confirm statement descriptor reads clearly (avoids chargebacks).

## 3. Premium video (Remotion worker)
- [ ] Deploy the `remotion/` worker (Docker) somewhere with headless Chromium.
- [ ] Set `RENDER_WORKER_URL` + `RENDER_WORKER_SECRET`. (Unset = graceful fallback to the ffmpeg audiogram video.)

## 4. Storage / data / infra env
- [ ] R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- [ ] Vercel KV (`@vercel/kv`) provisioned.
- [ ] `OPENAI_API_KEY` (Whisper transcription + input moderation).
- [ ] `ANTHROPIC_API_KEY` (lyrics).
- [ ] Suno API key on a **paid** plan (free tier rate-limits will throttle launch).
- [ ] `CRON_SECRET` (birthday reminders / dunning crons) + confirm Vercel cron schedule.
- [ ] `USER_SESSION_SECRET` (magic-link "My Songs" login).
- [ ] Supabase env (venues, legal_acceptance, events).

## 5. Email deliverability
- [ ] Resend domain verified; **SPF, DKIM, DMARC** DNS records set for singmybirthday.com.
- [ ] Test: song-ready email, abandoned-preview recovery, birthday reminder, venue dunning.

## 6. Legal / compliance
- [x] Terms, Privacy, Cookies, **Refund** pages live and linked in footer.
- [ ] Confirm the legal entity + effective date in `lib/legal.ts` are current.
- [ ] Confirm support inbox `info@singmybirthday.com` is monitored (refund requests route here).

## 7. Monitoring
- [ ] Sentry `SENTRY_AUTH_TOKEN` / DSN set for source maps + error capture.
- [ ] Spot-check Vercel function logs for `[share-create:highlight-cut]`, `[moderation-blocked]`, `[share-preview]` after first real songs.

---

### Known follow-ups (not launch blockers)
- Regenerate route returns the raw Suno track (no highlight-cut re-run) — fine for a preview, revisit later.
- Broaden unit tests (input sanitizers, moderation categories) over time.
- Paid songs already reset their 90-day KV TTL on unlock; extend if you want indefinite retention.
