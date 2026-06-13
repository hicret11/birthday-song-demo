# Product-output packages — for Hicrete

Turns a generated song/share into a **post-ready package** (video/audio + thumbnail +
captions + links + metadata), categorized by promotional-use permission. **Nothing is
auto-posted or scheduled.** The app is untouched — this only *reads* share data.

## Run — single
```bash
npm run content:package-share -- --share-id=<id>          # build the package
npm run content:package-share -- --share-id=<id> --dry    # show the bucket, write nothing
```

## Run — batch (explicit list, NOT a KV scan)
```bash
# 1) copy the template and fill in known share IDs (one per line; # comments + blanks ok)
cp content-automation/share-ids.example.txt content-automation/share-ids.txt
# 2) package them all
npm run content:package-share -- --share-ids-file=content-automation/share-ids.txt
npm run content:package-share -- --share-ids-file=content-automation/share-ids.txt --dry
```
Batch packages **only the IDs you list** — it never scans/enumerates KV. This is the
**safer** mode: no risk of touching unrelated shares, no global reads, predictable cost,
and you stay in control of exactly which songs get packaged. A failure on one ID is logged
and the batch continues. A summary is written to
`content-automation/product-outputs/_batch-report.json` with counts: `packaged`, `failed`,
and per-bucket (`approved-for-promo`, `private-share-only`, `needs-permission`).
(`share-ids.txt` is gitignored; the `.example` template is tracked.)

## Optional: record package metadata to the admin table (`--record-admin`)
By default the CLI is filesystem-only. Add `--record-admin` to **also upsert one row**
into Supabase `admin_content_packages` (by `share_id`) so the future admin UI can list
packages. Works in single and batch mode.

```bash
npm run content:package-share -- --share-id=<id> --record-admin
npm run content:package-share -- --share-id=<id> --record-admin --dry   # prints the payload, writes nothing
npm run content:package-share -- --share-ids-file=content-automation/share-ids.txt --record-admin
```

- **Requires the Phase B migration applied** (`supabase/migrations/20260613000000_create_admin_content_tables.sql`).
  If the table doesn't exist, packaging still succeeds and the CLI reports
  `admin: NOT recorded — admin_content_packages not found — apply the Phase B migration first`
  (and `admin_recorded:false` in the batch report). Nothing crashes.
- **Status mapping** from permission bucket: `approved-for-promo → pending-review`
  (enters Hicrete's review queue), `needs-permission → needs-permission`,
  `private-share-only → private-share-only`.
- **Writes ONLY `admin_content_packages`** — never KV, never `promo_permissions`.
- **No emails, no local paths.** `thumbnail_url` is left `null` until an R2/Blob upload
  step exists; `video_url`/`audio_url` use the existing R2 URLs.
- **No posting/scheduling** happens — this only records metadata for review.
- `--dry --record-admin` prints the exact upsert payload and writes nothing (no files, no DB).

## Where packages go
```
content-automation/product-outputs/
├─ approved-for-promo/<share-id>/    ← the ONLY bucket Hicrete posts publicly
├─ private-share-only/<share-id>/    ← do NOT post publicly (declined or minor recipient)
└─ needs-permission/<share-id>/      ← do NOT post publicly (no promo permission on record)
```

Each package contains:
`video.mp4` (or `audio.mp3` if no video) · `thumbnail.jpg` ·
`caption-tiktok.txt` · `caption-instagram.txt` · `caption-youtube.txt` ·
`share-url.txt` · `metadata.json` · `permission-status.txt`

## For Hicrete — how to use this
1. **Only open `approved-for-promo/`.** Every folder there is complete and cleared for
   public posting: the video/thumbnail to upload, three ready captions (with CTA +
   UTM links to singmybirthday.com), and the share URL.
2. **Never post anything from `private-share-only/` or `needs-permission/`.** Those are
   share-only or pending permission — see each `permission-status.txt`.
3. No share-page hunting, no database access — everything you need is in the folder.

## What each bucket means (fail-closed)
| Bucket | Meaning |
|---|---|
| `approved-for-promo` | A `promo_permissions` row exists with **granted=true** and **not a minor recipient**. Public posting OK. |
| `private-share-only` | Permission **declined**, or recipient is a **minor** (always suppressed from public). Share-only. |
| `needs-permission` | **No** promo-permission record found. Do not post publicly. |

A package can only reach `approved-for-promo` with an explicit positive, non-minor
permission record. Unknown / missing / minor / declined never becomes public.

## Env required (read-only; set in `birthday-song-demo/.env.local`, never paste secrets)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — load the share
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — read promo permission
- `NEXT_PUBLIC_SITE_URL` — share-page base URL (defaults to https://singmybirthday.com)

If any required var is missing, the CLI exits with a clear error and writes nothing.

## Notes
- **Read-only**: the CLI never writes to KV/Supabase or changes the app.
- **No PII**: `metadata.json` contains the recipient **first name only** — no emails or
  sender data.
- **No auto-posting**: packaging ≠ posting. Hicrete posts manually from `approved-for-promo/`.
- `product-outputs/` is gitignored (media + recipient-referencing data — never commit).
