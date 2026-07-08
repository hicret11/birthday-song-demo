# Premiere video on Remotion Lambda — go-live checklist

Phase D renders the deliverable video **as the premiere** (curtain → name-in-
lights marquee → Ken-Burns photo scenes → audio-reactive bars → director's note
→ credits roll) on **AWS Lambda** via Remotion. It's **env-gated**: with the
`REMOTION_*` env unset, the render path is a clean no-op and the app falls back
to the Railway worker (if `RENDER_WORKER_URL` is set), then to the existing
ffmpeg video. Nothing breaks before you deploy the Lambda. This is the operator
checklist. It needs an AWS account.

Company is ≤3 people → **Remotion's license is free**; the only cost is AWS
Lambda usage (pennies per render, nothing when idle).

> **Version lock (important).** The app pins `@remotion/lambda@4.0.484`, matching
> the `remotion@4.x` in `remotion/`. The deployed Lambda **function** and **site**
> must be created with the **same Remotion version**. If you upgrade Remotion,
> re-deploy the function and site and bump the app's `@remotion/lambda` together
> — a version mismatch is the #1 cause of Lambda render failures.

## 1. AWS IAM (one-time)
1. Create an IAM user for Remotion with the Remotion Lambda policy (see
   `npx remotion lambda policies user` / `... role` for the exact JSON).
2. Create an access key for that user → note the key id + secret.

## 2. Deploy the Lambda function + the site (from `remotion/`)
```
cd remotion
npx remotion lambda functions deploy          # → prints the function name
npx remotion lambda sites create src/index.ts --site-name=premiere   # → prints the serve URL
```
- The **function name** → `REMOTION_LAMBDA_FUNCTION_NAME`.
- The **serve URL** → `REMOTION_SERVE_URL`.
- Re-run `sites create` (same `--site-name`) whenever the composition changes so
  the deployed bundle matches the code.

## 3. Environment variables (Vercel → Production)
```
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
REMOTION_AWS_REGION=us-east-1          # the region you deployed to
REMOTION_LAMBDA_FUNCTION_NAME=...      # from step 2
REMOTION_SERVE_URL=...                 # from step 2
```
Code reads these via `lib/render-lambda.ts`. All five (plus the key/secret) must
be present for `isLambdaConfigured()` to be true; otherwise the render path
no-ops and falls back.

## 3b. ⚠️ New-AWS-account limits (hit during go-live 2026-07-09 — READ THIS)
The account was brand new, which surfaced two AWS-side limits. The deploy + a
real render were verified anyway (1920×1080 h264+mp3, 29s, played from Vercel
Blob), but for **production-speed renders you must lift the concurrency quota**:

1. **Lambda concurrency quota (REQUIRED before relying on Lambda in prod).**
   A single premiere render fans out across many parallel Lambdas. On a new
   account the "Concurrent executions" quota is tiny, so the default render path
   fails fast with *"AWS Concurrency limit reached (Rate Exceeded)"*. Fix:
   AWS Console → **Service Quotas → AWS Lambda → "Concurrent executions"** →
   request an increase (1,000 is the normal established-account value; ask for at
   least a few hundred). Approval can take a few hours to a day.
   - Until then, production is SAFE but not using Lambda: `requestPremiumRender`
     catches the failure and falls back to the ffmpeg video, so buyers still get
     *a* video — just not the Lambda premiere. Nothing breaks.

2. **Memory capped at 3008 MB.** New accounts can't set Lambda memory > 3008 MB
   without a limit increase. The function is deployed at **3008 MB / 600 s /
   2048 MB disk** (`remotion-render-4-0-484-mem3008mb-disk2048mb-600sec`), which
   is plenty. (The heavy PremiereVideo composition is ~0.3–0.5 s/frame, so the
   generous timeout matters when concurrency is low; with the quota lifted, many
   small chunks each finish well under the timeout and renders are fast.)

Re-verify after the quota increase by simply unlocking a Deluxe song and
confirming the Lambda premiere (not the ffmpeg fallback) appears on the share
page.

## 4. How it runs once live
- On unlock (Deluxe/Production), `requestPremiumRender` renders the `PremiereVideo`
  composition on Lambda, polls to completion, copies the MP4 from Lambda's S3 to
  **Vercel Blob**, and sets `premiumVideoUrl` + `videoStatus:"ready"`. The share
  page already prefers `premiumVideoUrl` over the ffmpeg `videoUrl`.
- **16:9** renders by default (projectable / YouTube). A **9:16** render can be
  triggered on demand (pass `aspect: "9:16"` to `renderPremiereOnLambda`) — wire
  a "share to stories" button to it later to avoid rendering both every time.
- If a Lambda render fails, it falls through to the Railway worker (if set), then
  the ffmpeg video — the buyer always gets *a* video.

## 5. Cost
Benchmark real cost before relying on a figure: `npx remotion lambda compositions`
+ Remotion's `estimatePrice()` (or the render output's cost line). Expect roughly
a few US cents per 60–90s render; there's no idle cost.

## 6. Smoke test
1. Env **unset**: unlock a Deluxe song → confirm the existing renderer still
   produces a video (no regression) and no AWS calls happen.
2. Env **set**: unlock a Deluxe/Production song → confirm the Lambda premiere
   renders, lands in Vercel Blob, and plays on the share page. The paywall is
   unchanged (video only after unlock; `toPublicSong` still strips it when locked).

## 7. Cleanup (only AFTER Lambda is verified in production)
Once Lambda is confirmed working, remove the on-Vercel ffmpeg slideshow path
(`app/api/slideshow/render` + `lib/slideshow.ts`). Keep the `remotion/` worker
server as a documented Railway fallback. (Not done yet — the ffmpeg path is the
current fallback and must stay until Lambda is proven with real AWS creds.)
