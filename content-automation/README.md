# Sing My Birthday — Content Automation (Phase 1: local render, no posting)

A developer-owned MVP that turns a JSON content calendar into **1080×1920 MP4s
+ platform captions + metadata**, fully locally. No CapCut, no Canva, no manual
editing. **It does not post anything** and connects to **no external APIs**.

## What it does
- Reads `calendar/posts.json` (the 14-post 2-week plan).
- Enforces compliance guardrails (below) and **blocks** non-compliant posts.
- Renders eligible posts with FFmpeg + `sharp`:
  - animated brand-gradient background (or a cleared local clip),
  - hook text, on-screen text, CTA end-card, brand logo,
  - 1080×1920, ~10s, H.264 + silent AAC track.
- Writes per-platform `.txt` captions and `.json` metadata sidecars.

## Stack (no new dependencies, no API keys, no spend)
- **FFmpeg** (system binary) — gradient background + overlay + encode.
- **sharp** (already used by `scripts/build_cake_assets.mjs`) — rasterizes the
  text/CTA/logo overlay from SVG (we avoid `drawtext` because this FFmpeg build
  has no libfreetype).
- Scripts are `.mjs` so they are **never** type-checked by `next build` and need
  no `tsx`/compile step.

## Folder layout
```
content-automation/
├─ calendar/posts.json        # source of truth (14 posts)
├─ assets/                    # OPTIONAL cleared background clips: <asset_id>.mp4
├─ output/                    # rendered MP4s + captions + metadata (gitignored)
└─ scripts/
   ├─ lib.mjs                 # schema, guardrails, text helpers
   ├─ validate-posts.mjs      # `content:validate`
   └─ render-posts.mjs        # `content:render`
```

## Run
```bash
npm run content:validate            # report eligible vs blocked (no render)
npm run content:render              # render all eligible posts (with audio bed)
node content-automation/scripts/render-posts.mjs --only=smb_wk1_d4   # one post
node content-automation/scripts/render-posts.mjs --silent            # render WITHOUT audio
node content-automation/scripts/render-posts.mjs --audio=path/to.m4a # use a different bed
node content-automation/scripts/render-posts.mjs --dry               # print plan only
```

## Audio bed (brand-safe, optional)
Videos are otherwise silent; by default the renderer mixes in a soft instrumental
**audio bed** so reviewer clips feel alive.

- **Source:** 100% **generated locally** by `scripts/make-audio-bed.mjs` using FFmpeg
  sine synthesis — an original soft major-key arpeggio (C–F–G–C) + pad. **No samples,
  no lyrics, no recognizable/copyrighted melody, no trending audio.**
- **File:** `assets/audio/brand-bed.m4a` (AAC, 10s, normalized to ≈ −18 LUFS, mixed
  under video at `BED_VOL = 0.22` so it stays subtle).
- **Regenerate:** `node content-automation/scripts/make-audio-bed.mjs --force`
- **Render silent:** add `--silent` (uses a silent AAC track; output still has an audio stream).
- **Custom bed:** `--audio=<file>` — but see the warning below.

> ⚠️ **Do NOT drop copyrighted or trending songs into the renderer** (`assets/audio/`
> or `--audio=`). Use only original/cleared/royalty-free audio. Trending-sound usage
> belongs to the manual posting step on-platform (where the platform licenses it), never
> baked into a rendered file we redistribute. This pipeline ships the safe generated bed only.

## Output, per post
```
output/<post_id>/
├─ <post_id>.mp4                       # 1080x1920 master (reused across platforms)
├─ captions/<post_id>.<platform>.txt   # caption + CTA + UTM link + hashtags
└─ meta/<post_id>.<platform>.json      # metadata (auto_post:false, render_status, …)
output/_render-report.json             # run summary
```

## Compliance guardrails (rendering is BLOCKED when…)
1. **Permission** — `asset_type` is not `brand_made` **and** `asset_permission_status`
   is not `cleared`. (Cleared lemoni/customer assets also require a
   `permission_record_url`.) → Lemoni assets stay blocked until cleared.
2. **Adult targeting** — `adult_targeting_confirmed` is not `true`.
3. **Destination** — any platform's `utm_urls` value does not point to
   `https://singmybirthday.com` with UTM params.
4. **Approval** — `approval_status` is `rejected`.

A soft scan flags possible child-directed phrasing as a **warning** for human review.
There is **no paid path** in this tool, and **no auto-posting**.

## How to add a cleared asset
1. Confirm permission and store proof (Slack/Drive link).
2. In `calendar/posts.json` for that post:
   - set `asset_permission_status: "cleared"`,
   - set `permission_record_url: "<link to the clearance>"`.
3. (Optional background clip) drop `assets/<asset_id>.mp4` — a cropped 1080×1920
   version is used automatically. Otherwise it renders on a brand gradient.
4. `npm run content:render`.

## Review workflow
1. `npm run content:render` → watch the MP4s in `output/<post_id>/`.
2. Read the platform caption `.txt` files.
3. When a post is approved, set `approval_status: "approved"` in `posts.json`
   (and `"rejected"` to permanently block one). Approval gates **Phase 2**, not rendering.

## Roadmap
- **Phase 2 (not built):** after `approval_status=approved`, schedule via **Ayrshare**
  (one API → TikTok / IG Reels / YT Shorts / FB). Still human-gated; still organic.
- **Phase 3 (not built):** pull post metrics, rank hooks, auto-suggest winner reposts.
- **Optional render upgrade:** swap the local FFmpeg renderer for **Creatomate/Shotstack**
  templates (hosted) or **Remotion** (programmatic) without changing the calendar schema.

**Hard constraints honored:** organic only · no auto-post · no API connections ·
no spend · no child-directed targeting · Lemoni/customer assets blocked until
`cleared` · every post drives to https://singmybirthday.com with UTM.
