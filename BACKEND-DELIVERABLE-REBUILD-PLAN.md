# Backend + Deliverable Rebuild Plan — matching the v4 "Production Studio"

_Goal: the delivered product must cash every check the new front-end (reimagined-flow-v4.html) writes. This maps every v4 promise → what exists today → the gap → concrete implementation, informed by a codebase audit + 2026 research. Sources for the research live in `MARKET-BRIEF-2026.md` and inline below._

---

## 0. The principle

The v4 flow promises a **theatrical premiere delivered on the birthday**: name in lights, the song, the director's note (typed or spoken) as the closing beat, a credits roll with the whole cast, then — on the top tier — the recipient's reaction filmed and sent back. Today the backend delivers a **flat player behind a paywall**, sent manually by the giver, and the theatrical reveal only renders for crowd songs. This plan closes that distance.

---

## 1. Gap map (promise → now → target)

| # | v4 promise | Today | Verdict | Target |
|---|---|---|---|---|
| 1 | Intake: name+pronunciation, **director credit**, moment, **feeling**, genre, language, birthday date, age | most fields exist; no first-class credit or feeling | 🟡 | add `directorCredit` + `feeling` to model + prompt |
| 2 | **Director's note** (text **+ voice**) revealed as the closing of the premiere | none | ❌ | new fields + record UI + render as closing beat |
| 3 | Premiere deliverable for **every** buyer: curtains, name in lights, song, note closing, **credits roll**, "produced by" | premiere is **crowd-only**; solo = flat template | 🟡 | make premiere the default deliverable + note + credits roll |
| 4 | Crowd woven into one song + **contributor names** in credits | works; names shown as a line | ✅ | reuse; upgrade to a proper credits roll |
| 5 | **Scheduled delivery** — held, released on the birthday, countdown | instant, giver sends link; birthday only used for a buyer reminder | ❌ | Inngest-scheduled delivery to recipient + countdown page |
| 6 | **Reaction-capture** — front camera films recipient, sent to giver | none | ❌ | opt-in, consent-first capture → private Blob → giver inbox (top tier) |
| 7 | **Three tiers**: Premiere $14.99 / Deluxe $24.99 / Full Production $44.99 + live-musician anchor | **two** plans (full/deluxe) | 🟡 | add 3rd tier + add-on line items in Stripe |
| 8 | Cast add-ons (AI call, live musician, character visit) | fully wired (booking, Stripe, scheduler) | ✅ | reuse; bundle AI call into Full Production |
| 9 | Relationship/feeling/genre steer the lyrics + song | relationship/genre steer; no explicit feeling | 🟡 | capture feeling, add to lyric + Suno style |
| 10 | Song pipeline: Suno, 15s paywall, Deluxe video, Remotion worker | working; slideshow unverified on Vercel; worker gated | 🟡 | keep; verify slideshow; use worker for stitched artifact later |
| 11 | Poster keepsake + **director's cut** (two takes / reshoot) | regeneration exists (cap 2); no poster | 🟡 | reframe regen as Take A/B; generate a poster image |

---

## 2. Data model changes (`lib/api-types.ts` → `SharedSong` + create request)

Add:
- `directorCredit?: string` — "their partner", etc. (the credit string; distinct from raw relationship).
- `feeling?: string` — the vibe chip ("goosebumps", "laughing till they cry"…).
- `directorNote?: { text?: string; voiceUrl?: string; voiceDurationSec?: number }` — the closing message.
- `delivery?: { deliverAt?: string /*ISO UTC*/; timezone?: string /*IANA*/; channel?: "email"|"sms"|"link"; recipientContact?: string; status: "draft"|"scheduled"|"delivered"|"opened"; }`
- `plan?: "premiere" | "deluxe" | "production"` (rename/extend current `"full"|"deluxe"`; keep back-compat mapping full→premiere).
- `reaction?: { assetUrl?: string; status: "invited"|"captured"|"sent"|"viewed"|"declined"; consentAt?: string }` (top tier only).
- `posterUrl?: string` — the director's keepsake image.
- `takes?: { a?: string; b?: string; chosen?: "a"|"b" }` — director's cut.

Naming note: code's `full`/"Standard" == v4 "Premiere". Migrate copy + `plan` values, keep a compatibility shim so existing unlocked songs still resolve.

---

## 3. The recipient deliverable — the biggest rebuild (`app/share/[id]` + `PremiereReveal`)

**Make the premiere the default for everyone, not just crowd songs.** Today `PremiereReveal` mounts only via `CrowdPremiere`; a solo buyer's recipient sees a flat template player. Rework `app/share/[id]/page.tsx` so every delivered song renders the premiere reveal, with the paywalled/flat player as a fallback only.

Reveal sequence (recipient, mobile-first, one page):
1. **Tap to raise the curtain** — a single gesture. Required anyway: browser autoplay policy blocks audio until a user gesture; do `await ctx.resume()` then `await audio.play()` **synchronously inside the tap handler** (iOS Safari is strict). ([Chrome autoplay](https://developer.chrome.com/blog/autoplay))
2. **Curtains part → name in lights** — CSS `transform` panels + `text-shadow` (GPU-composited; avoid `clip-path`).
3. **Song plays** with an audio-reactive bar visualizer — one cached `AnalyserNode` (`fftSize` 256) via `createMediaElementSource`; must `analyser.connect(destination)` or it's silent; only one source per element (cache; guard React Strict Mode double-invoke). ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource))
4. **Director's note as the closing beat** — text, or the spoken voice clip (see §5).
5. **Credits roll** — "Starring [name] · Produced by [credit] · With love from [crowd names]." Upgrade the current one-line crowd credit into a real scroll.
6. `prefers-reduced-motion` static variant (motion gated behind `@media (prefers-reduced-motion: no-preference)`).

Retire the Russian-hardcoded `/premiere` demo route or repoint it at real data.

---

## 4. Scheduled birthday delivery (`lib/delivery` + Inngest)

**Recommended architecture:** on unlock, compute the UTC instant for "9am local on their next birthday," store `deliverAt` (UTC) + `timezone` (IANA), and schedule via **Inngest** (durable across redeploys/timeouts; `step.sleepUntil`). At wake, send **immediately** via Resend (email) and/or Twilio (SMS); skip provider-native scheduling (Resend 30-day / Twilio 35-day windows are too short for gifts booked months ahead). ([Inngest delayed](https://www.inngest.com/docs/guides/delayed-functions), [Resend schedule](https://resend.com/docs/dashboard/emails/schedule-email), [Twilio scheduling](https://www.twilio.com/docs/messaging/features/message-scheduling))

Details:
- Store **IANA timezone name**, never an offset (DST/future law safety). Recompute UTC at wake.
- Recipient-facing **countdown page**: if opened before `deliverAt`, show "Their premiere opens in N days" (a locked ticket); after, the full reveal.
- **Inngest free plan caps `sleepUntil` at 7 days** — confirm our plan covers the max lead time, or fall back to a daily Vercel Cron due-check for far-future gifts.

**Open product decision (needs Nia):** do we now collect the **recipient's contact** (email/phone) + timezone and deliver to them on the day, or keep "giver gets a link + we notify the giver to send on the day"? v4 implies we deliver. This changes intake + privacy — see §12.

---

## 5. Voice note in the premiere (`lib/upload` + reveal)

**v1 = simple sequential playback.** Store the giver's MediaRecorder clip in Vercel Blob; in the reveal, when the song `<audio>` fires `ended`, play the voice `<audio>`. Zero server compute, no ffmpeg risk — 95% of the payoff. Defer server-side stitching/ducking (blocked by Vercel's 250MB function bundle limit; if ever needed, do it on the existing Remotion worker, not a Vercel function). ([Vercel fn limits](https://vercel.com/docs/functions/limitations))

Recording UI already exists for pronunciation + crowd voice — reuse the MediaRecorder pattern for the director's note.

---

## 6. Reaction-capture (top tier) — build carefully, phase last

**Consent-first, ephemeral, adults-only.** Record front camera+mic via `getUserMedia` + `MediaRecorder` (feature-detect codec: Safari mp4, Chromium webm/vp9), cap ~15–20s, upload direct to **private** Vercel Blob via client `upload()` (`handleUpload`, 4.5MB function-body limit forces client upload), auto-delete after the giver views or N days.

Legal surface is real: face+voice is biometric-adjacent; audio triggers **two-party consent** states (CA/FL/IL); **2025 COPPA** now covers minors' voice/video → **gate to adults, explicit opt-in = consent**, recipient explicitly chooses Send/Discard (no auto-send), short retention. ([FTC/COPPA](https://www.fenwick.com/insights/publications/ftcs-new-coppa-guidance-on-recording-childrens-voices-five-tips-for-app-developers-and-toymakers-to-comply)) iOS Safari stops capture the instant the tab backgrounds — listen for `visibilitychange`, auto-save what was captured.

This is the **riskiest** piece (legal + iOS fragility). Recommend shipping it **last**, gated to the $44.99 tier, fully skippable.

---

## 7. Pricing — three tiers + add-ons (Stripe)

Per the compromise/anchor research (see `MARKET-BRIEF-2026.md`): three tiers, middle marked "most chosen," live musician visible as the up-anchor.

- **The Premiere — $14.99** (A/B/C geo): full song, premiere reveal page, MP3, director credit, scheduled delivery.
- **The Deluxe Premiere — $24.99**: + photo-scene video.
- **The Full Production — $44.99**: + AI character call (Zoltar) + reaction-capture + priority.

Implementation: each tier = its own **Product + one-time Price**; each add-on (AI call, reaction) = its own Product+Price; build `line_items` server-side from tier + selected add-ons (Stripe supports multiple prices in `payment` mode). Consider Stripe **Adaptive Pricing** for geo (must toggle in Dashboard) instead of hand-rolled A/B/C, or keep A/B/C. On `checkout.session.completed`, set `metadata:{tier, addons}`. ([Stripe optional items](https://docs.stripe.com/payments/checkout/optional-items), [adaptive pricing](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing))

Extend `scripts/stripe-setup.sh` with the 3rd tier + add-on SKUs (new `_v3` lookup keys; prices are immutable).

---

## 8. Director's cut (Suno two takes) + poster

- Suno returns **2 clips per generate call** — surface both as **Take A / Take B** for the buyer to pick (maps perfectly to "director's cut"). "Reshoot" = another generate call. Lock the chosen vocal as a **Persona** so reshoots keep the same singer. **Copy every clip to our Blob immediately** — Suno hosts expire in ~15 days. No official Suno API — keep a provider abstraction (unofficial wrappers: sunoapi.org etc.). ([sunoapi.org docs](https://docs.sunoapi.org/suno-api/generate-music))
- Reuse the existing `regenerate` endpoint (cap 2) reframed as takes.
- **Poster keepsake:** render a shareable image (name, "a [feeling] [genre] production", "directed by [credit]", date) — either an OG-style dynamic image (`@vercel/og`) or a canvas export. Low risk.

---

## 9. Relationship + feeling personalization

Capture `feeling` in intake, add it (plus `directorCredit`) to `buildLyricPrompt` and `refineStyleForSuno` so tone actually reflects "goosebumps" vs "laughing till they cry." Milo's relationship-aware suggestions in v4 become real prompt inputs.

---

## 10. Phased build (proposed sequence, each behind a preview)

- **Phase A — the deliverable (highest impact, lowest risk):** premiere-for-everyone + director's note (text + voice, sequential playback) + credits roll + data-model fields + feeling/credit into prompts. This alone makes the product match the flow's emotional core.
- **Phase B — pricing:** 3-tier ladder + add-on line items + Stripe SKUs + intake tier selection. Unlocks monetization the flow implies.
- **Phase C — scheduled delivery:** recipient countdown page + Inngest send-on-birthday (email/SMS) + timezone capture. (Depends on the §4/§12 delivery-model decision.)
- **Phase D — director's cut + poster:** Take A/B pick + poster keepsake.
- **Phase E — reaction-capture:** last, gated to Full Production, consent-first, adults-only.

---

## 11. Risk ranking (from research)

1. **Reaction-capture** — legal (biometric/minors/two-party) + iOS backgrounding fragility. Phase last, gate to adults.
2. **Suno two-takes** — no official API; unofficial dependency + 15-day retention (must re-host). Wrap it.
3. **Voice stitching (fancy)** — Vercel 250MB ffmpeg wall; avoided by sequential playback.
4. **Scheduled delivery** — Inngest free 7-day sleep ceiling + timezone/DST correctness.
5. **Premiere page** — mostly known; only sharp edge is iOS autoplay-unlock-in-gesture.
6. **Stripe packaging** — lowest risk.

---

## 11b. Video generation — rebuild (research-backed)

The current video is an on-Vercel ffmpeg slideshow (fragile: Vercel's 250MB function bundle limit + ffmpeg is discouraged there). The new deliverable must look like the premiere: curtain-raise, name-in-lights marquee, photos as Ken-Burns "scenes", audio-reactive bars synced to the song, director's note, credits roll — in 16:9 (project at the party) and 9:16 (social).

**Decision: render with Remotion, on Remotion Lambda.** The theatrical look (audio-reactive + bespoke motion) rules out template APIs (Creatomate/Shotstack/JSON2Video) — their editors can't do true audio-reactivity or fine keyframe control. Remotion reuses the same React/CSS design as the web premiere, handles Suno-song + voice-note muxing natively, and Lambda auto-parallelizes a 60–90s 1080p render into tens of seconds. Kill on-Vercel ffmpeg; keep the existing self-hosted Remotion worker scaffold as a fallback only.

- Pipeline: Vercel route → `renderMediaOnLambda()` → poll/webhook → copy MP4 to Vercel Blob → share. Job state in Supabase.
- Build the premiere as ONE parameterized Remotion composition (props: name, photos[], songUrl, directorNote, voiceNoteUrl, credits[], format). Render 16:9 by default, 9:16 on demand (each aspect ratio ≈ doubles cost/time).
- **Cost driver is the Remotion license, not AWS.** For-profit companies with **4+ employees** need the Automators plan: **$0.01/render, $100/month minimum**; **free at ≤3 employees**. AWS compute at ~1k renders/mo is ~$20–100. → **Open question for Nia: how many employees is the company?** (determines whether video carries a $100/mo floor). Confirm before commercial launch — see [remotion.dev/docs/license](https://www.remotion.dev/docs/license).
- Sources in the research pass; benchmark real per-render cost with Remotion's `estimatePrice()` on the actual composition before trusting a number.

This becomes **Phase D-video** (after the web premiere + pricing), reusing the composition design from Phase A's web reveal.

## 12. Decisions I need from Nia

1. **Delivery model:** do we collect the **recipient's email/phone + timezone** and deliver the premiere on their birthday (true to v4), or keep giver-sends-the-link with a birthday countdown page? (Affects intake + privacy.)
2. **Reaction-capture:** build it (adults-only, opt-in, $44.99 tier) or defer to a later release given the legal weight?
3. **Pricing:** confirm the ladder ($14.99 / $24.99 / $44.99) and that Full Production bundles the AI call — note the AI call needs ElevenLabs+Twilio go-live (currently dormant), so Full Production can't fully deliver until that's switched on.
4. **Scope/pace:** build all phases now, or ship Phase A (the deliverable) first to prod, then the rest?
