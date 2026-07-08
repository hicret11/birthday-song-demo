# Preview-gate hardening — implementation plan

Goal: an unpaid user must never receive the full-length song, only the ≤15s
preview. This is the P0 revenue-leak item from `GO-LIVE-CHECKLIST.md`.

## What's ALREADY secure (verified — do not touch)

The recipient-facing **share page is fully gated**:

- `lib/public-song.ts` `toPublicSong()` strips every media URL
  (`audioUrl`, `fullAudioUrl`, `highlightAudioUrl`, `previewAudioUrl`,
  `videoUrl`, `premiumVideoUrl`, `slideshowVideoUrl`) from a **locked** song
  before it reaches the client. Unlocked songs pass through.
- `app/api/share/[id]/preview/route.ts` serves a **real ≤15s MP3** (fast path
  proxies the stored `previewAudioUrl`; legacy path ffmpeg-trims to 15s). It can
  physically only emit 15s.
- `app/api/share/[id]/download/route.ts` returns **402** when locked.
- `components/share/UnlockableAudio.tsx` plays `/api/share/{id}/preview` when
  locked; the client-side 15s clamp is defense-in-depth over an already-15s file.
- At share-create (`app/api/share/route.ts`), three distinct R2 assets are
  produced: `{id}-highlight.mp3` (~55s), `{id}-full.mp3`, `{id}-preview.mp3`
  (~15s), stored on the song as `highlightAudioUrl` / `fullAudioUrl` /
  `previewAudioUrl` (`lib/audio-cut.ts`: TARGET_CUT_SEC=55, PREVIEW_SEC=15).

## The actual gaps (all on the CREATOR's own path, not the recipient's)

1. **`/generate` step-3 reveal player** (`app/generate/GeneratorClient.tsx:2572`)
   plays `audioProxyUrl ?? audioUrl` — the **raw full Suno track** — with only a
   client-side clamp (`onTimeUpdate`, line 2583; comment: "Client-side only for
   v1"). The full URL is in the DOM.

2. **Deeper root cause:** the full Suno URL reaches the client via the
   **generation status poll** (`audioUrl = data.audioUrl`, ~line 1005). So even
   if you fix the `<audio src>`, the full URL still sits in client JS / the
   network tab. The poll response must stop returning the full URL to an unpaid
   client.

3. **`app/api/audio/[id]/route.ts` is ungated** — streams the complete Suno file
   for any 32-hex id, no unlock check.

4. **R2 objects are public + guessable** (`lib/r2.ts` returns unsigned
   deterministic `{R2_PUBLIC_URL}/audio/{id}-full.mp3`). `toPublicSong` hides the
   URL but the object is still publicly readable if the path is guessed. Not
   defense-in-depth.

> Exposure note: gaps 1–2 only leak the song to the **creator themselves** (the
> person being asked to pay for their own song). Recipients they share with hit
> the already-gated share page. Real, but narrower than "anyone can bypass."

## Fix plan (ordered; each independently shippable)

### Step 1 — stop the status poll from returning the full URL to unpaid clients
- File: the generation status route the client polls (find via
  `grep -rn "audioUrl" app/api` — look for the poll/status handler that returns
  `data.audioUrl`, likely `app/api/**/status` or the music-poll route).
- Change: when the song isn't unlocked, return a **preview reference** instead of
  the full Suno URL — e.g. return `{ status: "complete", previewReady: true }`
  and have the client play `/api/share/{shareId}/preview`. Only return the full
  URL after unlock is confirmed server-side.
- This requires the share to exist before playback. The generate flow already
  auto-creates the share on audio-ready (`autoShareTriggeredRef`, ~line 811) and
  gates the unlock CTA on `shareUrl`. Reuse that: play the gated preview once
  `shareUrl` exists; show "Preparing your preview…" for the ~1–2s before.

### Step 2 — point the /generate reveal player at the gated preview
- File: `app/generate/GeneratorClient.tsx:2572`.
- Change `src={audioProxyUrl ?? audioUrl}` → a computed `previewSrc`:
  - locked: `/api/share/${shareId}/preview` (derive `shareId` from `shareUrl`,
    as done at line 1349).
  - unlocked (post-checkout return): the full `audioProxyUrl ?? audioUrl`.
- Keep the client clamp as defense-in-depth.

### Step 3 — gate `/api/audio/[id]`
- File: `app/api/audio/[id]/route.ts`.
- Either add an unlock check (thread the share id + unlock state) or reserve this
  proxy for unlocked-only contexts and never reference it from a locked view.

### Step 4 (recommended) — make full/highlight R2 objects private
- Files: `lib/r2.ts`, `app/api/share/route.ts`.
- Upload `{id}-full.mp3` / `{id}-highlight.mp3` as **private**; serve only through
  the already-gated download route via a short-lived signed URL or server proxy.
- Keep `{id}-preview.mp3` public (it's meant to be free).

## Verification (must run on the real machine — sandbox can't run the server)

1. `npx tsc --noEmit` clean; `npm test` green.
2. `npm run dev`, generate a song. In dev-tools **Network**: confirm the status
   poll response contains **no** full Suno / `-full.mp3` URL while locked.
3. Step-3 player: confirm `<audio src>` is `/api/share/{id}/preview`; the file is
   ≤15s; scrubbing past 15s is blocked.
4. `curl` the guessed `{R2_PUBLIC_URL}/audio/{id}-full.mp3` → should be **403**
   after Step 4 (or still 200 if you defer Step 4 — note the residual risk).
5. Complete a test purchase → returns unlocked → full song plays + download 200.
6. Recipient share link while locked: only 15s, `/download` = 402 (regression
   check — should already pass).
