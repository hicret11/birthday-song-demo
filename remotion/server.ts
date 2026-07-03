// Remotion render worker — a tiny HTTP server.
//
// Exposes POST /render. Authenticates a bearer RENDER_WORKER_SECRET, accepts
// { song, captions }, bundles the Remotion project, renders the BirthdaySong
// composition to a temp MP4, uploads it to Cloudflare R2, and returns { url }.
//
// This process is what makes the "separate worker" architecture work: the Next
// app (on Vercel) never imports remotion; it just POSTs here. Deploy this as a
// container on Fly/Railway/Render (see README.md).
//
// Everything is best-effort and heavily logged; render failures return 500 with
// a short message rather than crashing the process.

import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { birthdaySongSchema, type BirthdaySongProps } from "./src/schema";

const PORT = Number(process.env.PORT ?? 8080);
const COMPOSITION_ID = "BirthdaySong";

// --- R2 upload (mirrors the Next app's lib/r2.ts minimal S3 usage) ----------
type R2 = { client: S3Client; bucket: string; publicUrl: string };
let cachedR2: R2 | null = null;

function getR2(): R2 {
  if (cachedR2) return cachedR2;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      "R2 env vars not configured: need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL",
    );
  }
  cachedR2 = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
    publicUrl,
  };
  return cachedR2;
}

async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  const { client, bucket, publicUrl } = getR2();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  const base = publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  return `${base}${key}`;
}

// --- Remotion bundle cache --------------------------------------------------
// Bundling is expensive; do it once per process and reuse the served URL.
let bundlePromise: Promise<string> | null = null;
function getBundle(): Promise<string> {
  if (!bundlePromise) {
    const entry = path.join(process.cwd(), "src", "index.ts");
    bundlePromise = bundle({ entryPoint: entry });
  }
  return bundlePromise;
}

/** Build composition props from an app SharedSong-ish payload + captions. */
function buildProps(song: Record<string, unknown>, captions: unknown): BirthdaySongProps {
  const raw = {
    name: song.name,
    senderName: song.senderName,
    personalNote: song.personalNote,
    audioSrc: song.highlightAudioUrl ?? song.audioUrl,
    theme: song.template,
    photoUrls: Array.isArray(song.photoUrls) ? song.photoUrls : undefined,
    watermark: "singmybirthday.com",
    captions: Array.isArray(captions)
      ? captions
      : Array.isArray(song.captions)
        ? song.captions
        : [],
    language: song.language ?? "English",
  };
  // zod validates + applies defaults (watermark, captions, language).
  return birthdaySongSchema.parse(raw);
}

async function handleRender(req: Request, res: Response): Promise<void> {
  const body = req.body as { song?: Record<string, unknown>; captions?: unknown };
  const song = body?.song;
  if (!song || typeof song !== "object") {
    res.status(400).json({ error: "missing song" });
    return;
  }

  const shareId = typeof song.id === "string" ? song.id : randomUUID().slice(0, 8);
  let props: BirthdaySongProps;
  try {
    props = buildProps(song, body.captions);
  } catch (err) {
    console.error(`[worker] invalid props for ${shareId}:`, err);
    res.status(400).json({ error: "invalid props" });
    return;
  }

  const workDir = await mkdtemp(path.join(tmpdir(), `remotion-${randomUUID()}-`));
  const outPath = path.join(workDir, "out.mp4");
  const started = Date.now();

  try {
    const serveUrl = await getBundle();
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: props,
    });

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: outPath,
      inputProps: props,
      // Chromium flags for headless/container rendering.
      chromiumOptions: { gl: "angle" },
    });

    const info = await stat(outPath);
    const buffer = await streamToBuffer(outPath);
    console.log(
      `[worker] rendered ${shareId} in ${Date.now() - started}ms bytes=${info.size}`,
    );

    const url = await uploadToR2(`premium/${shareId}.mp4`, buffer, "video/mp4");
    console.log(`[worker] uploaded ${shareId} → ${url}`);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "render failed";
    console.error(`[worker] render failed for ${shareId}:`, message);
    res.status(500).json({ error: message });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function streamToBuffer(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(filePath)
      .on("data", (c) => chunks.push(c as Buffer))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/render", (req, res) => {
  const secret = process.env.RENDER_WORKER_SECRET;
  if (secret) {
    const auth = req.header("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  } else {
    console.warn("[worker] RENDER_WORKER_SECRET not set — accepting unauthenticated requests");
  }
  // Best-effort: never let a handler rejection crash the process.
  handleRender(req, res).catch((err) => {
    console.error("[worker] unhandled render error:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
});

app.listen(PORT, () => {
  console.log(`[worker] Remotion render worker listening on :${PORT}`);
});
