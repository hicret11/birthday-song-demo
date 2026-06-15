# AI-Generated Background Asset Plan

How to produce safe, high-quality **abstract** background videos for Sing My
Birthday share videos using an AI video tool **manually / offline**, review them,
encode to spec, and register them — so the existing per-song background-selection
system (`lib/video-style.ts`, shipped in PR #19) has real variety to choose from.

> **Hard rules (do not violate)**
> - **No AI video API calls from the product.** Generation is manual/offline only.
> - **No per-song AI generation, no async jobs, no photo upload** (separate, deferred phases).
> - **No people, faces, hands, brands, logos, on-screen text, celebrity likeness,
>   artist names, or “<artist> style” prompts.** Backgrounds are abstract only.
> - **Nothing is uploaded to R2 until the assets are explicitly approved.**
> - The song's own audio is muxed in at render time, so backgrounds are **silent**.

---

## 1. Recommended workflow (offline, manual review)

1. **Generate** 4–8s abstract clips in an AI video tool (paid plan with commercial
   rights — see §2). One clip per target background; iterate prompts until clean.
2. **Download** the source clip(s) at the highest resolution offered (≥1080p).
3. **Review frames first** — extract stills (§6) and check against the QA list (§5)
   *before* spending effort on looping/encoding. Reject anything with faces, text,
   logos, warped artifacts, or a busy center.
4. **Extend / loop to 60s** — AI clips are short; build a seamless ~60s loop (§7).
5. **Encode to spec** — 1920×1080, 30fps, H.264, yuv420p, faststart, **silent** (§7).
6. **Final review** — extract frames again, and (optional) burn sample overlay text
   to confirm legibility behind white / pink / gold copy.
7. **Approval gate** — share frames/clips for sign-off. **Do not upload until approved.**
8. **Upload + register** — push to R2, add filenames to the registry, verify (§8).

Keep source clips + intermediate files **outside the repo** (e.g. a local
`~/smb-bg-work/` folder). Only the final encoded MP4s go to R2; only filenames go
into the code.

---

## 2. Tool options & commercial-rights warning

> ⚠️ **Commercial-rights warning.** AI-tool licensing changes often and differs by
> plan. Before using any output commercially: (a) generate on a **paid** tier,
> (b) confirm the current Terms grant **commercial use and ownership/broad license**
> of outputs, (c) confirm **indemnity**/training-data provenance if available, and
> (d) keep a dated screenshot of the plan's license terms. Verify per tool at use time.

| Tool | Strengths | Notes for our use |
|---|---|---|
| **Adobe Firefly Video** | Trained on licensed/owned content; marketed as commercially safe; IP-indemnity on enterprise. | **Most rights-safe** choice. Good for abstract motion. **Recommended primary if rights-safety is the priority.** |
| **Runway (Gen-4 / later)** | High motion quality, strong control, loop/extend tooling. | Commercial use on paid plans — verify ToS. Great quality alternative. |
| **Luma Dream Machine** | Smooth abstract motion, has loop options, fast. | Commercial use on paid plans — verify ToS. Strong for seamless abstract loops. |
| **Pika** | Fast, stylized, good for playful/confetti energy. | Verify commercial terms on paid tier. |
| **Kling** | High fidelity. | Non-US vendor — **scrutinize commercial/territorial terms and data handling carefully.** |
| Others (Sora, Hailuo/MiniMax, Veo) | Varying quality/availability. | Verify commercial licensing individually. |

**Recommendation:** Use **Adobe Firefly Video** as the **primary** tool for the
first test (cleanest commercial-rights story for brand/ads use). If a specific look
is hard to achieve there, fall back to **Luma Dream Machine** (best seamless-loop
abstract motion) — on a paid plan with verified commercial terms. Start with **one**
tool for the first 4 assets to keep the look consistent.

---

## 3. Prompt pack (4 initial backgrounds)

Each is abstract, 16:9, center-clear, loopable, no people/text/logos. Drop these
into the tool's prompt field; pair every one with the **negative prompt** in §4.

### classic-aurora-60s
> Abstract aurora-like ribbons of soft deep-purple and warm magenta light drifting
> slowly across a dark navy background, gentle diagonal flow, soft bokeh haze,
> cinematic and elegant, **dark and uncluttered in the center**, seamless looping
> motion, 16:9, no text, no people.

### elegant-gold-60s
> Abstract elegant scene of soft golden light streaks and slow shimmering gold
> particles drifting over a deep charcoal-black background, luxurious and calm,
> subtle depth-of-field, **center area kept dark and clear**, very slow seamless
> motion, 16:9, no text, no people.

### neon-pulse-60s
> Abstract synthwave-inspired neon glow of violet and cyan light beams gently
> pulsing and sweeping over a near-black background, smooth gradient bloom, soft
> light leaks, **dim clear center**, hypnotic seamless loop, 16:9, no text, no people.

### playful-confetti-60s
> Abstract festive motion of soft out-of-focus confetti specks and gentle colorful
> light bokeh (pink, amber, purple, teal) floating upward on a **darker muted
> background so light text stays readable**, cheerful birthday energy, soft and
> dreamy not busy, seamless loop, 16:9, no text, no people, no balloons with faces.

> Tip: for `playful-confetti`, explicitly ask for a **darker / muted** base — bright
> full-frame color hurts white/pink text contrast (the gradient sample test showed this).

---

## 4. Negative prompt (use with every generation)

> people, faces, hands, bodies, silhouettes, text, letters, words, numbers, captions,
> watermark, signature, logo, brand, trademark, UI, frames, borders, photographs,
> celebrity, recognizable characters, warped objects, distorted shapes, glitches,
> flicker, harsh strobing, fast chaotic motion, cluttered busy center, low quality,
> artifacts, jpeg noise, oversaturated blowout.

---

## 5. QA checklist (review every asset before approval)

- [ ] **Center stays readable** — middle third is calm/dim enough for overlay text.
- [ ] **No text artifacts** — zero letters/numbers/watermarks anywhere.
- [ ] **No people/faces/hands** — not even partial or background figures.
- [ ] **No logos/brands/trademarks.**
- [ ] **No creepy/warped objects** — no melting shapes, no uncanny forms.
- [ ] **Motion not too busy** — slow, smooth, ambient; no strobing/flicker.
- [ ] **Works behind white, pink (#ec4899), and gold text** — check all three.
- [ ] **Loops cleanly** — no visible jump/seam at the wrap point.
- [ ] **On-brand vibe** — birthday / music / celebratory, elegant not cheap.
- [ ] **Rights** — generated on a paid plan with verified commercial terms; license screenshot saved.

Reject and re-prompt on any failure. Prefer re-generating over "fixing" in post.

---

## 6. Frame-review helper (local, read-only)

Extract stills to review quickly (uses the bundled ffmpeg):

```sh
FF=$(node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)")
# one frame at 2s
"$FF" -ss 2 -i source-clip.mp4 -frames:v 1 review-2s.png -y
# optional: check legibility with sample overlay (copy font to a no-space path first)
cp public/video-fonts/Inter-Bold.ttf /tmp/Inter-Bold.ttf
"$FF" -ss 2 -i source-clip.mp4 -vf \
 "scale=1280:-2,drawtext=fontfile=/tmp/Inter-Bold.ttf:text='Happy Birthday':fontsize=64:fontcolor=white:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.34,drawtext=fontfile=/tmp/Inter-Bold.ttf:text='Maya':fontsize=92:fontcolor=0xec4899:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.45" \
 -frames:v 1 review-overlay.png -y
```

---

## 7. Technical processing plan (AI clip → spec-compliant 60s loop)

Target spec (match the existing R2 templates exactly):
**1920×1080 · 60s · 30fps · H.264 (libx264) · yuv420p · `+faststart` · no audio.**

**Step A — seamless loop.** AI clips are ~4–8s. Two options:

*Option 1 — tool-native loop* (preferred): if the tool offers a "loop" mode (Luma
does), export an already-seamless short loop and skip to Step B.

*Option 2 — ping-pong loop* (works for any clip; abstract motion tolerates reverse):

```sh
FF=$(node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)")
# forward + reversed = one seamless ping-pong cycle (no seam at the joins)
"$FF" -i source.mp4 -filter_complex \
  "[0:v]reverse[r];[0:v][r]concat=n=2:v=1:a=0,format=yuv420p[v]" \
  -map "[v]" -an pingpong.mp4 -y
```

*Optional — crossfade loop* (smoother than ping-pong if motion shouldn't reverse):
overlap the last ~1s onto the first ~1s with `xfade`. Use only if needed.

**Step B — extend to 60s + encode to spec:**

```sh
"$FF" -stream_loop -1 -i pingpong.mp4 -t 60 \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart -an classic-aurora-60s.mp4 -y
```

Notes:
- `-an` strips audio (silent — song audio is added at render).
- `scale+crop` guarantees exactly 1920×1080 even if the AI export differs.
- `-preset slow -crf 20` for a clean one-time encode (these are pre-rendered, so
  encode time doesn't matter; the share renderer downscales to 720p anyway).
- Verify the result with `ffmpeg -i out.mp4` → expect `1920x1080 … yuv420p … 30 fps`,
  `Duration 00:01:00`, and **no audio stream**.

---

## 8. Upload & register plan

**Filenames (final encoded MP4s):**
```
classic-aurora-60s.mp4
elegant-gold-60s.mp4
neon-pulse-60s.mp4
playful-confetti-60s.mp4
```

**R2 paths** — same bucket/prefix as the current templates:
```
templates/classic-aurora-60s.mp4
templates/elegant-gold-60s.mp4
templates/neon-pulse-60s.mp4
templates/playful-confetti-60s.mp4
```
Base URL: `https://pub-4a5a0d0e9e504b74a6c9751524055c49.r2.dev/templates/`
Upload via `scripts/upload-templates-to-r2.ts` (same path the originals used). **Only after approval.**

**Register** in `lib/video-style.ts` → `TEMPLATE_VARIANTS` (add the new filename to
each template's array so the pool has >1 and selection varies):
```ts
const TEMPLATE_VARIANTS: Record<ShareTemplate, string[]> = {
  classic: ["classic-60s.mp4", "classic-aurora-60s.mp4"],
  elegant: ["elegant-60s.mp4", "elegant-gold-60s.mp4"],
  neon:    ["neon-60s.mp4",    "neon-pulse-60s.mp4"],
  playful: ["playful-60s.mp4", "playful-confetti-60s.mp4"],
};
```
(Or, for genre-keyed looks, populate `GENRE_VARIANTS` instead — see `docs/VIDEO-BACKGROUNDS.md`.)

**Verification after upload + register:**
1. **Reachability:** `curl -I` each new R2 URL → `200`.
2. **Selection unit-check:** `templateVideoPath(t, {seed})` now returns the multi-variant
   pool deterministically (and still falls back if a name is missing).
3. **Render test:** create 2–3 test shares per template (preview/non-prod), confirm
   (a) different backgrounds appear across shares, (b) render stays within the ~120s
   budget, (c) overlay text remains legible on each new background.
4. **Rollback:** if any asset looks wrong in production, remove its filename from
   `TEMPLATE_VARIANTS` (selection falls back to the remaining variants instantly) —
   no need to delete the R2 object.

---

## Sequencing

1. Generate + review 4 clips (Firefly primary). →
2. Approval gate (frames). →
3. Encode to spec + final review. →
4. Approval gate (final MP4s). →
5. Upload to R2 + register in `lib/video-style.ts` (small PR). →
6. Verify + monitor.

No code changes are required by this doc; registration in step 5 is the only future
code edit, gated on your asset approval.
