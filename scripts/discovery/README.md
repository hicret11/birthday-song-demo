# Discovery batch — name-song SEO library

Generates per-name birthday songs and the YouTube/TikTok upload kit:
horizontal MP4, vertical MP4, thumbnail JPG, and metadata JSON.

## Prerequisites

Set these in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
SUNO_API_KEY=...
# optional
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
SUNO_API_BASE_URL=https://api.sunoapi.org
```

Keys are read from `.env.local` first, then `.env.production.local` as
fallback. Existing values in the shell environment win over both.

## Usage

```bash
# Smoke test — 3 names (≈ $0.33). No --confirm needed for small batches.
npm run discovery:batch -- --limit=3

# Full 100 names (≈ $11). Requires --confirm.
npm run discovery:batch -- --confirm

# Combined (limit subset, no confirm gate for ≤ 5)
npm run discovery:batch -- --limit=10 --confirm
```

## Output

```
out/discovery/
├── generation-log.csv                # one row per attempt (success/failure)
└── {slug}/
    ├── {slug}-1080p.mp4              # horizontal, name burned in via ffmpeg drawtext
    ├── {slug}-vertical.mp4           # 1080×1920, padded for TikTok/Reels
    ├── {slug}-thumbnail.jpg          # 1280×720, brand gradient + name overlay
    └── {slug}-metadata.json          # {title, description, tags, hashtags, category}
```

## What this does NOT do

- Upload to YouTube / TikTok — those are manual (or a separate
  YouTube Data API task once the channel exists).
- Per-region name lists beyond US-100.
- Per-name SEO landing pages on the site.

## Estimated cost & throughput

| Item | Per name | Per 100 |
|------|----------|---------|
| Suno generation | ~$0.10 | $10 |
| Claude Haiku metadata | ~$0.001 | $0.10 |
| ffmpeg + sharp local | $0 | $0 |
| **Total** | **~$0.11** | **~$11** |

Throttle: 1 generation per 30 seconds (Suno safety). Each Suno render
takes ~45–75 s. End-to-end runtime for the full 100 ≈ 2.5–3 hours.

## Troubleshooting

- `Missing required env vars` → put keys in `.env.local`.
- `Suno status polling timed out` → the script's per-name timeout
  is 4 min. Check Suno dashboard for stuck jobs.
- `[share-create:render-failed]` log lines from `renderShareVideo` →
  audio download failed; the script will treat the name as failed and
  move on. Inspect `generation-log.csv` for which names errored.
