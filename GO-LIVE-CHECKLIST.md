# Sing My Birthday — Go-Live Runbook

Single source of truth for finishing the consumer song-paywall launch. Everything in **§A** is done + verified. **§B** is the ordered remaining path (each item needs a real account / decision). **§C** is reference detail.

Branch: `feat/consumer-song-paywall` (pushed, HEAD `1961592`, 8 commits ahead of `main`). Nothing merged to `main` yet.

---

## A. Done & verified this session ✅

- **Code**: consumer paywall, audio highlight-cut, server-side preview gating, input moderation, refund page, i18n server/client split, offer alignment, video polish. `tsc` clean, `npm test` 13/13, `next build` passes (verified on the real machine).
- **Paywall e2e — LIVE**: under Stripe **test** on the correct entity (**GLOBAL MOBILITY TECHNOLOGIES LLC**, `acct_1RdC8U…`). Locked share served only a 15s preview, `/download` = 402, no full-media URL leaked; after card `4242…` → webhook `song_unlock` → unlocked, `/download` = 200. Confirmed in logs + UI.
- **Real generation on Vercel preview** — CONFIRMED: `[share-create:highlight-cut] cut=55s full=164s` on a real Suno track (proves the ffprobe→ffmpeg duration fix works on prod infra).
- **Offer model = Option A** (decided): the buyer's **Standard = the FULL track**. The highlight-cut (55s) powers ONLY the 15s preview + the video/karaoke. **Deluxe differentiator = the photo slideshow only.** Paywall copy ("The complete song / full version") and the generator tizer (plays full 2:44) are coherent with this.
- **Video composition (Remotion)** — polished v2: centered mirrored waveform, current-word karaoke pop, richer photo grade, progress bar.

---

## B. Remaining path to launch (ordered)

### B0. Security — rotate leaked tokens ⚠️ (do first; ~10 min)
During setup these leaked into terminal transcripts and should be rotated:
- [ ] **Vercel tokens** (×3) — Account → Settings → Tokens → revoke + create new.
- [ ] **Supabase** token/service-role key — Project → Settings → API → rotate; update in Vercel env.
- [ ] **Stripe TEST secret key** (GMT LLC sandbox) — Developers → API keys → Roll.
- [ ] After rotating, update any local `.env.local` + Vercel env, and hand new tokens to tooling. Do this BEFORE more CLI deploys so nothing breaks mid-flow.

### B1. Vercel plan — move production to **Pro** under GMT LLC
- [ ] Vercel **Hobby is non-commercial-use only** — a paid product must be on **Pro**. Also unlocks the hourly `recover-previews` cron (`vercel.json` has `0 * * * *`, which Hobby rejects at deploy validation).
- [ ] Ensure the production project lives under the **GMT LLC** Vercel team (matches the legal entity + Stripe account), not `glomotec`.

### B2. Stripe — create LIVE products (test ones already exist)
Test products exist under GMT LLC sandbox (product `prod_Uohf…`, 6 prices). For launch, recreate in GMT LLC **live** mode:
- [ ] Product "Sing My Birthday — Full Song" + 6 one-time prices → env:
  - `STRIPE_PRICE_ID_TIER_A` $9.99 / `_TIER_B` $5.99 / `_TIER_C` $2.99
  - `STRIPE_PRICE_ID_DELUXE_A` $14.99 / `_DELUXE_B` $9.99 / `_DELUXE_C` $5.99
- [ ] `STRIPE_SECRET_KEY` = `sk_live_…` (GMT LLC).
- [ ] Live webhook endpoint → prod URL `/api/stripe/webhook`, event `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`.
- [ ] Activate payments on the GMT LLC account (Stripe "Activate/Setup" — required for live charges).
- [ ] Clear statement descriptor (reduces chargebacks); matches GMT LLC.

### B3. Confirm required env is present in **Production** scope
Already present in Vercel (Sensitive) for the generation stack — just verify:
- [ ] `ANTHROPIC_API_KEY`, `SUNO_API_KEY` (paid Suno plan), `OPENAI_API_KEY` (**re-issued this session — confirm the new key is valid; the old one 401'd, which silently disabled moderation + Whisper captions**).
- [ ] `BLOB_READ_WRITE_TOKEN` (media storage is **Vercel Blob** — the old `R2_*` vars are no longer used; `lib/r2.ts` is a thin alias over `@vercel/blob`), KV, Supabase.
- [ ] `CRON_SECRET`, `USER_SESSION_SECRET`, Sentry DSN/`SENTRY_AUTH_TOKEN`.

### B4. Merge & deploy
- [ ] Open PR `feat/consumer-song-paywall` → `main` (8 commits, reviewable). Merge.
- [ ] Production deploy.

### B5. Production smoke test (confirms the low-risk fixes on real infra)
- [ ] Generate one real song on prod → check logs: **no `[moderation] … 401`** (key valid), `[share-create:highlight-cut] cut=~55s`, video `duration ≠ 0`.
- [ ] Locked share exposes only `/api/share/[id]/preview` (≤15s); `/download` = 402.
- [ ] One real purchase (small live charge) → unlock → full song plays + MP3 download; then **process a refund** to confirm the refund flow.

### B6. Email deliverability
- [ ] Resend domain verified; **SPF / DKIM / DMARC** for singmybirthday.com.
- [ ] Test: song-ready, abandoned-preview recovery, birthday reminder, venue dunning. Confirm `info@singmybirthday.com` is monitored (refund requests land there).

### B7. Premium video — deploy the Remotion worker (quality; can follow launch)
Until deployed, shares get the ffmpeg **simple 16:9** video (the premium 9:16 audiogram fails on Vercel's minimal ffmpeg build — filter "Option not found" — and falls back). The real premium karaoke video is the Remotion worker in `remotion/`.
- [ ] Deploy `remotion/` (Dockerfile provided) to a host with headless Chromium (Fly.io / Railway / Render). See `remotion/README.md`.
- [ ] Set `RENDER_WORKER_URL` + `RENDER_WORKER_SECRET` + the same R2 creds. Then unlock triggers the Remotion render and the share prefers it over the ffmpeg video.
- [ ] Swap `remotion/src/Root.tsx` defaultProps (currently offline test `sample.mp3` + test photos) — the worker passes real song/photo/caption props at render time, so this is only for local preview.

---

## C. Reference / known follow-ups (not blockers)
- **ffmpeg premium audiogram** fails on Vercel ("Option not found") → simple 16:9 fallback ships until the Remotion worker is up. Fixing the filtergraph is possible but low-ROI vs deploying Remotion.
- **Regenerate route** returns the raw Suno track (no highlight-cut re-run) — fine for a fresh take.
- **Deployment Protection (SSO)** is on for Vercel previews (`all_except_custom_domains`); automated curl checks against a preview need a Protection-Bypass secret (none created).
- Paid songs reset their 90-day KV TTL on unlock; extend if you want longer retention.
- Broaden unit tests (input sanitizers, moderation categories) over time.
- Legal: entity/date in `lib/legal.ts` = GLOBAL MOBILITY TECHNOLOGIES LLC — confirm current before launch.
