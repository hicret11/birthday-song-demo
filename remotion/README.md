# Remotion render worker

A **self-contained package**, separate from the Next app, that renders the
premium 9:16 karaoke birthday video (`BirthdaySong`) and uploads the MP4 to
Vercel Blob (the same store the Next app uses).

## Why it's separate

Rendering an MP4 needs headless Chromium (`@remotion/renderer`), which cannot
run on Vercel serverless functions. So the Next app **never imports `remotion`**.
Instead the app:

1. Transcribes the song to word timings (`lib/transcribe.ts`, Whisper).
2. POSTs a render job (`{ song, captions }`) to **this** worker
   (`lib/render-video.ts` → `${RENDER_WORKER_URL}/render`).

This worker renders and uploads, then returns `{ url }`, which the app persists
as `premiumVideoUrl`. If `RENDER_WORKER_URL` is unset, the app quietly keeps its
existing ffmpeg-rendered video — nothing breaks.

## Install

```bash
cd remotion
npm install
```

(This package has its own `package.json` and is intentionally excluded from the
Next app's `tsconfig.json`, `.vercelignore`, so the app build never touches it.)

## Run locally

```bash
# Interactive preview / composition studio
npx remotion studio

# One-off render to out/video.mp4 (uses the composition's defaultProps)
npx remotion render BirthdaySong out/video.mp4

# Render with custom props
npx remotion render BirthdaySong out/video.mp4 \
  --props='{"name":"Sam","audioSrc":"https://.../song.mp3","theme":"neon","captions":[],"language":"English","watermark":"singmybirthday.com"}'

# Run the HTTP render worker (POST /render)
npm run server
```

Test the worker:

```bash
curl -X POST http://localhost:8080/render \
  -H "Authorization: Bearer $RENDER_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"song":{"id":"abc123","name":"Sam","audioUrl":"https://.../song.mp3","template":"classic","language":"English","lyrics":{"raw":""}},"captions":[{"text":"happy birthday","startMs":0,"endMs":2000}]}'
```

## Environment

| Var | Purpose |
| --- | --- |
| `RENDER_WORKER_SECRET` | Bearer token the worker checks on `POST /render` (must match the app's value). |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token — **must be the same store the Next app uses** so the app can serve the uploaded MP4. |
| `PORT` | HTTP port (default 8080). |

Storage is **Vercel Blob**, identical to the Next app (the app's `lib/r2.ts` is
a thin alias over `@vercel/blob`). Copy `BLOB_READ_WRITE_TOKEN` from the Vercel
project's Storage → Blob settings so the worker writes into the very store the
app reads from. No secrets are committed — set these in the worker host's env.

## Deploy the worker

### Option A — Container (Fly / Railway / Render) — recommended

A minimal `Dockerfile` is included. It installs Chromium's shared libs and runs
`npm run server`. Deploy examples:

- **Fly.io**: `fly launch` (uses the Dockerfile), set secrets with
  `fly secrets set RENDER_WORKER_SECRET=... BLOB_READ_WRITE_TOKEN=...`, then
  `fly deploy`. Point the Next app's `RENDER_WORKER_URL` at
  `https://<app>.fly.dev`.
- **Railway / Render**: create a new service from this `remotion/` directory,
  it auto-detects the Dockerfile. Add the env vars above. Use the service's
  public URL as `RENDER_WORKER_URL`.

Give the container ≥2 vCPU / 2–4 GB RAM — Chromium rendering is CPU-bound.

### Option B — Remotion Lambda (serverless alternative)

Instead of a long-running server you can render on AWS Lambda with
[`@remotion/lambda`](https://remotion.dev/docs/lambda):

```bash
npm i @remotion/lambda
npx remotion lambda functions deploy
npx remotion lambda sites create src/index.ts --site-name birthday-song
```

Then replace `server.ts`'s `renderMedia` path with `renderMediaOnLambda(...)`
and keep the same `POST /render` → `{ url }` contract (Lambda uploads to S3;
copy or serve that URL, or re-upload it to Vercel Blob via `uploadToBlob`). The
Next app side is unchanged — it only cares about `RENDER_WORKER_URL` returning
`{ url }`.

## Contract

`POST /render` — headers: `Authorization: Bearer <RENDER_WORKER_SECRET>`; body:
`{ song: SharedSong, captions: {text,startMs,endMs}[] }`. Response: `{ url }`
(the uploaded MP4's public Vercel Blob URL) or `{ error }` with a non-200 status.
