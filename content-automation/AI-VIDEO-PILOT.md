# AI Video Pilot — Sing My Birthday (manual, no spend, no posting)

A tiny pilot: **manually** generate 3–5 AI scene clips in **one** tool, drop them into
this repo, quality-check them, and let the existing local renderer finish them (hook
text + song snippet + CTA + captions + logo + UTM). **No API keys, no subscriptions,
no auto-posting, no deploy.** Everything here is review-only.

> Why a pilot: we want AI scenes as a core source, but we don't yet know if they earn
> attention for *our* audience. Generate a handful by hand, finish them locally, judge
> the result — then decide whether a paid/API setup is worth it.

---

## 1. Which tool to use first → **Luma Dream Machine**

| Tool | Free start today | Motion realism | Notes for the pilot |
|---|---|---|---|
| **Luma Dream Machine** ✅ | Yes (free credits) | Natural, smooth | Friendly web UI, good at cozy/emotional b-roll — **best for a fast free pilot** |
| Runway (Gen-3/4) | Limited free credits | High | Best **future API** path; pick this if you'll commit to API automation soon |
| Pika | Some free credits | Med-High | Fun, less consistent |
| Kling | Free daily credits | Very high | Great output but **verify commercial terms / region** before relying on it |
| Sora / OpenAI video | Gated / plan-bound | Very high | Access + usage terms unsettled; skip for a quick free pilot |

**Pick: Luma Dream Machine** for the manual pilot — usable free tier, minimal setup,
natural motion for emotional scenes. (If you already intend to build on **Runway's API**
later, run the pilot on Runway instead for continuity — same workflow below.)

> ⚠️ **Commercial-use caveat:** free tiers often **watermark** and/or grant **non-commercial**
> rights only. That's fine for this pilot (we are NOT posting). Before any clip is ever
> published, confirm commercial rights + remove watermark — which generally means a paid
> plan. We are not buying anything yet.

---

## 2 & 3. The 5-clip pilot set (highest chance / lowest risk)

These five were chosen because they're emotionally strong and **low-risk to generate**
(little or no tight face/hand work — the riskiest thing for AI video). Order them
easiest-first: clips 1 and 5 have no people at all.

### Clip 1 — Phone glow, custom song (signature) 🟢 easiest
- **Prompt:** "Vertical 9:16 cinematic extreme close-up of a modern smartphone lying on a soft cream blanket, glowing warmly in a dim cozy room, gentle warm light pulsing softly, blurred fairy-light bokeh in the background, shallow depth of field, intimate, realistic, no text on screen."
- **Negative:** children, kids, people, faces, readable screen text/UI, brand logos, watermark, distorted shapes, low quality, jitter.
- **Duration:** 5s · **Camera:** very slow push-in.
- **Expected output:** warm glowing-phone mood loop; the song audio is the star.
- **Why it performs:** the product *is* the visual; pairs perfectly with a name-drop snippet; near-zero artifact risk.
- **Quality check:** glow looks natural, no fake UI text, loops cleanly.
- **Compliance:** ✅ no people. **Fallback:** our gradient bg (already supported).

### Clip 2 — Song-style roulette abstract background 🟢 easiest
- **Prompt:** "Vertical 9:16 abstract music-themed background of flowing light ribbons and soft particles slowly shifting through warm color moods, dreamy, premium, no people, no text, seamless gentle motion."
- **Negative:** people, children, faces, text, logos, watermark, harsh strobing, low quality.
- **Duration:** 6s · **Camera:** slow drift.
- **Expected output:** colorful motion bed for 4 genre snippets + labels.
- **Why:** interactive ("comment your fave"), no realism risk.
- **Quality check:** no flicker/strobe, colors on-brand, no stray text.
- **Compliance:** ✅ no people. **Fallback:** gradient bg.

### Clip 3 — Cozy late-night last-minute gift 🟡
- **Prompt:** "Vertical 9:16 cinematic cozy late-night scene, an adult wrapped in a blanket on a couch with a warm lamp and a mug, calm relieved soft smile while looking down at a phone, warm film grain, intimate, three-quarter angle, shallow depth of field."
- **Negative:** children, teens, minors, brand logos, readable text, distorted hands/extra fingers, uncanny face, celebrity likeness, watermark.
- **Duration:** 6s · **Camera:** subtle handheld.
- **Expected output:** warm "I sorted it in minutes" relief moment.
- **Why:** relatable last-minute emotion; calm = scroll-stopping contrast.
- **Quality check:** face/hands acceptable; reads clearly as an **adult**; no warping.
- **Compliance:** ⚠️ adult-only — reject if subject looks young/ambiguous. **Fallback:** Clip 1.

### Clip 4 — POV: you forgot their birthday 🟡
- **Prompt:** "Vertical 9:16 cinematic scene, an adult sitting up in a dim bedroom lit only by a glowing phone at night, a worried expression turning to relief, warm lamp bokeh, handheld feel, realistic, moody warm tones, three-quarter angle."
- **Negative:** children, teens, minors, brand logos, readable text, distorted hands, uncanny face, celebrity likeness, watermark, low quality.
- **Duration:** 6s · **Camera:** slow push-in.
- **Expected output:** panic→relief beat that sets up the "made a song in 2 min" payoff.
- **Why:** strong relatable hook + tag-a-friend energy.
- **Quality check:** expression reads in first 2s; adult; no artifacts.
- **Compliance:** ⚠️ adult-only. **Fallback:** Clip 1 + hook text carries it.

### Clip 5 — Gift card vs custom song contrast 🟡
- **Prompt:** "Vertical 9:16 cinematic two-part scene: first a plain blank generic gift card tossed onto a table under dull cool light, then a warm glowing phone playing music while an adult hand rests nearby, warm inviting light, clear visual contrast, realistic, no readable text or logos."
- **Negative:** real/branded gift cards, brand logos, readable text, children, distorted hands, watermark, celebrity likeness, low quality.
- **Duration:** 7s · **Camera:** cut between the two halves.
- **Expected output:** boring→magical value contrast.
- **Why:** instant value framing; "she'd cry" comment bait.
- **Quality check:** card is blank/generic (no brand); hands ok; clean cut.
- **Compliance:** ⚠️ keep the card generic. **Fallback:** Clip 1.

> Generate **clips 1, 2, and 3** first (highest success rate). If those finish well, do 4 and 5.

---

## 4. Schema support for AI clips (additive — nothing existing breaks)

These fields are **optional** additions to a calendar post in `calendar/posts.json`. The
renderer reads them; existing posts and guardrails are unchanged. A ready-to-paste post is
in `calendar/post.ai-example.json`.

| Field | Meaning |
|---|---|
| `asset_type` | `"ai_generated"` |
| `asset_permission_status` | `"na_brand_made"` (synthetic, no real person → no permission record needed) |
| `ai_tool` | e.g. `"luma"` |
| `ai_prompt` | the prompt used |
| `ai_negative_prompt` | the avoid-list used |
| `ai_generation_status` | `pending` \| `generated` \| `failed` |
| `ai_quality_status` | `pending` \| `approved` \| `rejected` |
| `ai_quality_notes` | reviewer notes |
| `source_ai_clip_path` | path to the **approved** clip, relative to `content-automation/` (e.g. `assets/ai-generated/approved/ai_phone_glow_01.mp4`) |

**Compliance note:** `na_brand_made` is only valid because AI subjects are **synthetic**.
If a clip resembles a **real or famous person**, reject it — do not post likenesses.

The existing guardrails still apply unchanged: adult_targeting_confirmed=true,
CTA/UTM → https://singmybirthday.com, not rejected. (Renderer background resolution now
checks `source_ai_clip_path` → `assets/ai-generated/approved/<asset_id>.mp4` → cleared
local clip → gradient fallback.)

---

## 5–7. Folders & manual workflow

```
content-automation/assets/ai-generated/
├─ inbox/      ← drop freshly downloaded clips here (un-reviewed)
├─ approved/   ← move here ONLY after passing the quality + compliance checklist
└─ rejected/   ← move here if it fails (keep for learning; never referenced)
```

**Manual workflow (no posting):**
1. Generate the clip manually in Luma using a prompt from §2.
2. Download the MP4 → save to `assets/ai-generated/inbox/` with a clear name
   (see naming below).
3. Review against the **quality + compliance checklist** (§ below).
4. Pass → move the file to `approved/`. Fail → move to `rejected/` (note why) and regenerate.
5. Add (or paste) a post in `calendar/posts.json` referencing the approved clip via
   `source_ai_clip_path` (copy from `post.ai-example.json`).
6. Run the local renderer for that post → it finishes the clip (hook/song/CTA/captions/logo).
7. Review the output MP4 + caption + metadata in `output/<post_id>/`.
8. **Stop. Nothing is posted or scheduled.** Approval/scheduling is a later phase.

**Naming convention:** `ai_<concept>_<NN>.mp4` →
`ai_phone_glow_01.mp4`, `ai_roulette_bg_01.mp4`, `ai_cozy_lastminute_01.mp4`,
`ai_pov_forgot_01.mp4`, `ai_giftcard_vs_song_01.mp4`. The `asset_id` in the post should
match the filename without extension.

### Quality checklist (gate before `approved/`)
- [ ] No visual artifacts (no morphing/flicker/warping)
- [ ] Hands/faces acceptable (or no people) — no extra fingers / melted features
- [ ] Subject clearly reads as an **adult** (reject if young/ambiguous)
- [ ] No brand logos, signage, readable text, celebrity/real-person likeness, copyrighted characters
- [ ] Emotion or hook is clear in the **first 2 seconds**
- [ ] Ties to product/song (a phone, a play moment, or works with the snippet)
- [ ] Not generic stock-wallpaper — has a specific moment
- [ ] Watermark acceptable for internal review (must be removed/licensed before any posting)

### Compliance checklist
- [ ] Adults-only, no children/minors
- [ ] No real/customer person; no private song/testimonial
- [ ] CTA → https://singmybirthday.com with UTM (handled by the renderer/caption)
- [ ] Marked `asset_type: ai_generated`, `asset_permission_status: na_brand_made`

---

## 8. Exact next steps (you can do today)

1. **Account:** go to Luma Dream Machine and start the **free** tier (no card, no
   subscription). *(If you'd rather pilot on Runway for API continuity, use its free credits instead.)*
2. **First prompt to paste** (Clip 1 — phone glow):
   ```
   Vertical 9:16 cinematic extreme close-up of a modern smartphone lying on a soft cream
   blanket, glowing warmly in a dim cozy room, gentle warm light pulsing softly, blurred
   fairy-light bokeh in the background, shallow depth of field, intimate, realistic, no
   text on screen.
   ```
   Avoid / negative: `children, people, faces, readable screen text, brand logos, watermark, distorted shapes, low quality`
3. **Save the download** to:
   ```
   content-automation/assets/ai-generated/inbox/ai_phone_glow_01.mp4
   ```
4. **Quality-check**, then move it to `approved/`:
   ```
   content-automation/assets/ai-generated/approved/ai_phone_glow_01.mp4
   ```
5. **Add the pilot post:** open `content-automation/calendar/posts.json`, copy the object
   from `content-automation/calendar/post.ai-example.json` into the `"posts"` array
   (it already points at `ai_phone_glow_01`). The other four pilot posts live in
   `content-automation/calendar/ai-pilot-posts.json` (see "All 5 pilot posts" below).
6. **Render it locally:**
   ```
   node content-automation/scripts/render-posts.mjs --only=smb_ai_pilot_phoneglow
   ```
   (add `--silent` to render without the audio bed)
7. **Review** the result in `content-automation/output/smb_ai_pilot_phoneglow/`. Repeat for
   clips 2–5. **Do not post anything.**

> If a clip looks bad and you don't have a replacement yet, the renderer **falls back to the
> brand gradient** automatically, so the post still produces a (filler) video.

---

## All 5 pilot posts

Pilot post JSON is staged in two files (neither is loaded by the renderer — `posts.json`
is the only live calendar, so it stays clean until you choose to insert):

| Clip | `asset_id` | Pilot post location |
|---|---|---|
| 1. Phone glow | `ai_phone_glow_01` | `calendar/post.ai-example.json` |
| 2. Style roulette | `ai_roulette_bg_01` | `calendar/ai-pilot-posts.json` |
| 3. Cozy last-minute | `ai_cozy_lastminute_01` | `calendar/ai-pilot-posts.json` |
| 4. POV forgot | `ai_pov_forgot_01` | `calendar/ai-pilot-posts.json` |
| 5. Gift card vs song | `ai_giftcard_vs_song_01` | `calendar/ai-pilot-posts.json` |

**Two ways to use them:**
- **One at a time (recommended):** approve a clip → move it to `assets/ai-generated/approved/`
  → paste that single post object into `posts.json` → `render-posts.mjs --only=<post_id>`.
- **All at once:** after all clips are approved, paste all 5 post objects into the `posts.json`
  `"posts"` array, then `npm run content:render` (only posts whose clips exist render with
  the clip; any missing clip falls back to the brand gradient).

Each pilot post's `ai_prompt` / `ai_negative_prompt` is embedded in its JSON, so the prompt
to paste into Luma is right there in the post object.

## Roadmap (after the pilot, with your approval only)
- If AI scenes outperform → commit to **one** generator (Luma or Runway) on a paid plan
  with **confirmed commercial rights** + a **spend cap**, and wire its API behind a human
  trigger (no auto-spend).
- Add Creatomate/Shotstack only to scale templated overlays.
- Ayrshare only to schedule **approved** posts (organic, Ray-gated).
