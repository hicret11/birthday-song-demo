# Video result — status & fix plan

## What a buyer gets today (end to end)

1. At **share-create** (every song, before payment), `app/api/share/route.ts:~413`
   renders a video via `lib/video.ts` `renderShareVideo` and stores it on R2 at
   `shares/{id}.mp4` → `song.videoUrl`.
2. `renderShareVideo` tries the **premium 9:16 audiogram** first
   (`renderShareVideoPremium`), which **throws "Option not found" on Vercel** —
   its minimal `@ffmpeg-installer/ffmpeg` build lacks `showwaves` and
   `colorchannelmixer` (`lib/video.ts` `buildPremiumFilterGraph:~610,~614`). It
   catches and falls back to `renderShareVideoSimple` → a **basic 16:9 MP4**
   (scaled template + burned "Happy Birthday {name}"). So buyers get a video,
   just the plain one.
3. The **Remotion karaoke video** (`premiumVideoUrl`) is **never produced** — the
   worker in `remotion/` isn't deployed, so `RENDER_WORKER_URL` is unset and
   `lib/render-video.ts` `requestPremiumRender` no-ops.
4. Video shows only on the **unlocked share page**
   (`components/share/templates/shared.tsx:~222`, `premiumVideoUrl ?? videoUrl`,
   gated `unlocked && currentVideo`). Download via `/api/share/[id]/download`
   (gated 402 when locked).

## Done in code (frontend + safe)

- **/generate result now shows a video teaser** (a 9:16 poster in the chosen
  template + "A shareable video, too") so the buyer sees song **and** video as
  the gift, at the buy moment. `app/generate/GeneratorClient.tsx` step-3 reveal.
- **Download route now prefers `premiumVideoUrl`** then `videoUrl`
  (`app/api/share/[id]/download/route.ts`) — no-op today, correct once the
  worker is live.

## Remaining (needs live Vercel / infra — can't verify in sandbox)

### A. "Video doesn't appear at all" — diagnose first
If a buyer gets NO video, both ffmpeg renderers threw. Check prod logs at
share-create for:
- `[share-create:audiogram-failed] …` (expected — premium falling back), then
- a SECOND error from `renderShareVideoSimple` → the real culprit. Usual causes:
  - **Font missing** in the serverless bundle. `drawtext` needs a real font file;
    confirm the font in `public/video-fonts/**` is included via
    `next.config.ts` `outputFileTracingIncludes` for `/api/share` (it is listed —
    verify the path/filename the code passes matches what's bundled).
  - **Audio download failed** (Suno/highlight URL 403/expired) before muxing.
  - **ffmpeg binary not traced** — confirm `@ffmpeg-installer/**` is in
    `outputFileTracingIncludes` for the route (it is; verify at runtime).
Fix whatever the simple-renderer error names; that restores the guaranteed video.

### B. Fix the premium 9:16 ffmpeg video (nicer, animated)
Goal: a vertical video with motion that survives Vercel's minimal ffmpeg.
- In `lib/video.ts` `buildPremiumFilterGraph`, **remove `showwaves` +
  `colorchannelmixer`** (unsupported). Replace the waveform with filters the
  minimal build DOES have — e.g. `showcqt` is also heavy; safer: a looping
  pre-rendered bars overlay, or `drawbox`/`geq`-based bars, or animate opacity via
  `fade`. Simplest reliable win: keep a static branded 9:16 background + animated
  `drawtext` (lyrics lines timed with `enable='between(t,a,b)'`) — no spectral
  filters at all.
- Verify by rendering on a real Vercel preview deploy (the failure is
  build-specific; local ffmpeg won't reproduce it). Watch for
  `[share-create:audiogram-failed]` disappearing from logs.

### C. Deploy the Remotion worker (the real premium karaoke) — infra
- Deploy `remotion/server.ts` (+ Dockerfile) to a host with headless Chromium
  (Fly.io / Railway / Render). See `remotion/README.md`.
- Set `RENDER_WORKER_URL`, `RENDER_WORKER_SECRET`, and the same R2 creds in
  Vercel. Trigger is already wired: `app/api/stripe/webhook/route.ts:~141` and
  `app/share/[id]/page.tsx:~85` → `requestPremiumRender`.
- On unlock it transcribes captions, renders 1080×1920, sets `premiumVideoUrl` +
  `videoStatus: "ready"`; the share page and download route already prefer it.

## Recommended order
A (make sure every buyer gets *a* video) → C (deploy Remotion for the premium
karaoke, highest quality-per-effort) → B only if you want a better pre-unlock/
non-Remotion video (checklist calls B low-ROI vs C).
