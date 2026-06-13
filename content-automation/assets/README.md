# Source assets (cleared clips only)

Drop **cleared** background video clips here, named `<asset_id>.mp4`, to use them
as a post's background instead of a generated gradient.

- A clip named `lemoni_A.mp4` is used **only** if the matching post has
  `asset_permission_status: "cleared"` (and, for lemoni/customer assets, a
  `permission_record_url`). Until then the renderer **blocks** that post — a file
  sitting here does not bypass the guardrails.
- Brand-made posts with `asset_id` starting `gradient_` always use a generated
  gradient and ignore this folder.

## `audio/`
`audio/brand-bed.m4a` — the license-safe generated soundtrack (see top-level README).

## `ai-generated/` (manual AI video pilot — see `../AI-VIDEO-PILOT.md`)
Manually-generated AI scene clips live here:
- `ai-generated/inbox/` — freshly downloaded clips, **not yet reviewed**
- `ai-generated/approved/` — passed quality + compliance; safe to reference from a post
- `ai-generated/rejected/` — failed review; kept for reference, never used

Background resolution order in the renderer: `source_ai_clip_path` →
`ai-generated/approved/<asset_id>.mp4` → cleared `<asset_id>.mp4` → brand gradient.

Do not commit customer/private clips or AI media. Clip media here is gitignored
(`.gitkeep` + metadata `.json` stay tracked).
