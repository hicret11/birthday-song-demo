# Sing My Birthday

Personalized AI birthday songs. A visitor describes the recipient, we generate
lyrics (OpenAI) and a full track (Suno), and produce a shareable page with a
karaoke video. The song is gated behind a one-time Stripe payment: a locked
share exposes only a 15-second preview; unlocking delivers the full track,
downloadable MP3/MP4, and (Deluxe) a photo slideshow. There is also a B2B
"venues" subscription track.

## Stack

- **Next.js 16** (App Router, `nodejs` runtime for media routes) + React 19, Tailwind 4
- **OpenAI** — lyric/style/name generation (Responses API) + Whisper captions + moderation
- **Suno** — music generation
- **Stripe** — one-time song unlocks + venue subscriptions (webhook-driven)
- **Supabase** — venues, legal acceptance, durable events
- **Vercel KV (Upstash)** — share storage, rate limiting, spend caps
- **Vercel Blob** — media (audio/video/photos); `lib/r2.ts` is a thin alias
- **Remotion** (`remotion/`) — premium karaoke video worker (deployed separately)
- **Resend** — transactional email · **Sentry** — error tracking

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in keys
npm run dev                        # http://localhost:3000
```

## Scripts

```bash
npm run build        # production build (runs migrations via buildCommand on Vercel)
npm test             # vitest suite
npm run lint         # eslint
npm run db:migrate   # apply Supabase migrations
```

## Key paths

- `app/api/generate-lyrics`, `app/api/generate-music` — generation pipeline
- `app/api/share/*` — share create, gated `preview` (≤15s), paywalled `download` (402 when locked)
- `app/api/stripe/webhook` — signature-verified; `song_unlock` → unlock, subscription events → venues
- `lib/public-song.ts` — **paywall gate**: strips all media URLs from a locked song's client payload
- `proxy.ts` — Next 16 proxy (optimistic `/admin/*` presence gate; real auth in `lib/admin-auth.ts`)

## Launch

See `GO-LIVE-CHECKLIST.md` for the ordered path to production (secret rotation,
Vercel Pro, Stripe live products, deploy, smoke test) and `DEPLOY-COMPLIANCE.md`
for the legal/compliance track.
