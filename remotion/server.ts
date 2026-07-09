// Remotion render worker — a tiny HTTP server.
//
// Exposes POST /render. Authenticates a bearer RENDER_WORKER_SECRET, accepts
// { song, captions }, bundles the Remotion project, renders the BirthdaySong
// composition to a temp MP4, uploads it to Vercel Blob, and returns { url }.
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
import { put } from "@vercel/blob";
import {
  birthdaySongSchema,
  premiereVideoSchema,
  type BirthdaySongProps,
  type PremiereVideoProps,
} from "./src/schema";

const PORT = Number(process.env.PORT ?? 8080);
const LEGACY_COMPOSITION_ID = "BirthdaySong";
const PREMIERE_COMPOSITION_ID = "PremiereVideo";

// --- Vercel Blob upload -----------------------------------------------------
// Storage matches the Next app (lib/r2.ts is itself a thin alias over
// @vercel/blob). The worker MUST share the same BLOB_READ_WRITE_TOKEN so the
// premium MP4 lands in the same store the app reads from — otherwise the app
// persists a premiumVideoUrl the visitor can't load. The historical R2/S3 path
// was removed because R2 was never provisioned (upload would always throw).
async function uploadToBlob(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not set — worker cannot upload the render");
  }
  const { url } = await put(key, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    // token is read from BLOB_READ_WRITE_TOKEN in the environment.
  });
  return url;
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
  const body = req.body as {
    song?: Record<string, unknown>;
    captions?: unknown;
    composition?: unknown;
    inputProps?: unknown;
  };
  const song = body?.song;
  if (!song || typeof song !== "object") {
    res.status(400).json({ error: "missing song" });
    return;
  }

  const shareId = typeof song.id === "string" ? song.id : randomUUID().slice(0, 8);

  // Two render modes:
  //  - PRIMARY: the app sends { composition: "PremiereVideo", inputProps } —
  //    the fully-resolved premiere props (identical to the Lambda path). We
  //    render the same premiere here, just without the per-render lambda cap.
  //  - LEGACY: only { song, captions } — render the older BirthdaySong slideshow
  //    (kept for backward compatibility).
  const wantsPremiere = body.composition === PREMIERE_COMPOSITION_ID && !!body.inputProps;
  const compositionId = wantsPremiere ? PREMIERE_COMPOSITION_ID : LEGACY_COMPOSITION_ID;

  let props: BirthdaySongProps | PremiereVideoProps;
  try {
    props = wantsPremiere
      ? premiereVideoSchema.parse(body.inputProps)
      : buildProps(song, body.captions);
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
      id: compositionId,
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
      `[worker] rendered ${shareId} (${compositionId}) in ${Date.now() - started}ms bytes=${info.size}`,
    );

    const url = await uploadToBlob(`premium/${shareId}.mp4`, buffer, "video/mp4");
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
