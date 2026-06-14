# Share Video Backgrounds

Generated share videos composite the song audio + text overlays onto a
pre-rendered background MP4 pulled from R2. Background **selection** lives in
`lib/video-style.ts` (`templateVideoPath`); the composite render lives in
`lib/video.ts` (`renderShareVideo`).

## Current state

Each of the four templates maps to exactly one background asset on R2:

```
templates/classic-60s.mp4
templates/elegant-60s.mp4
templates/neon-60s.mp4
templates/playful-60s.mp4
```

With one asset per template, selection is a no-op and the rendered video is
identical to before this change. Variety only "turns on" once more assets are
uploaded and registered (below).

## How selection works

`templateVideoPath(template, { genre, seed })` builds a candidate pool and picks
one **deterministically**:

1. Start with the template's variants (`TEMPLATE_VARIANTS[template]`).
2. Append any genre-themed variants (`GENRE_VARIANTS[genre.toLowerCase()]`).
3. Pick `hash32("{template}|{genre}|{seed}") % pool.length`.

The seed is the **share id**, so a given song always renders the same background
(stable across retries/regenerations), while different songs spread across the
available backgrounds. If a pool is empty it falls back to `{template}-60s.mp4`.

## Adding more backgrounds (no code-flow change needed)

1. **Produce** a background MP4 offline. Match the existing assets:
   - 1920×1080, ~60s, H.264 (`yuv420p`), 30fps.
   - Abstract / original motion only — **no celebrity likeness, no copyrighted
     artist/album imagery, no third-party logos or music** (the song audio is
     muxed in at render time; any audio track on the background is discarded).
   - Keep the center reasonably clear — text overlays (name, "Happy Birthday",
     note, attribution) are burned over the background.
2. **Upload** to R2 under `templates/` (same bucket/prefix as the current
   assets; see `scripts/upload-templates-to-r2.ts`).
3. **Register** the filename in `lib/video-style.ts`:
   - Per template: add to `TEMPLATE_VARIANTS`, e.g.
     `classic: ["classic-60s.mp4", "classic-bokeh-60s.mp4"]`.
   - Per genre: add to `GENRE_VARIANTS`, e.g.
     `pop: ["pop-confetti-60s.mp4", "pop-lights-60s.mp4"]`.

### Suggested naming

```
templates/{template}-{variant}-60s.mp4   # e.g. classic-bokeh-60s.mp4
templates/{genre}-{variant}-60s.mp4       # e.g. pop-confetti-60s.mp4
```

`{template}` ∈ classic | elegant | neon | playful. `{genre}` is the lowercased
genre label (pop, r&b, rock, jazz, hip-hop, electronic).

## Safety / cost notes

- No AI video APIs, no per-render generation — backgrounds are pre-encoded, so
  there is **no added render cost or latency** (R2 storage/bandwidth only).
- No user photos involved (none are collected today).
- Selection is pure/deterministic — no schema change, no async jobs.
