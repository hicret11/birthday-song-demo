// Gated preview stream (~24s — see PREVIEW_SEC in lib/audio-cut).
//
// This is the ONLY audio surface a locked (un-paid) share exposes. It can never
// return more than PREVIEW_SEC, so it's safe to serve without an unlock check —
// even if someone hits it directly they only ever get the teaser.
//
// Fast path: a share created after the highlight-cut pipeline shipped already
// has `previewAudioUrl` on R2 — we just proxy those bytes. Legacy path: older
// shares get their preview lazily generated (download source → ffmpeg-trim) and
// persisted back so the next hit is on the fast path.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadSharedSong, updateSharedSong } from "@/lib/share";
import { renderPreviewFromFile, PREVIEW_SEC } from "@/lib/audio-cut";
import { uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;
const FETCH_TIMEOUT_MS = 25_000;

function streamHeaders(): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  // Safe to cache: a 15s teaser is public by design.
  headers.set("Cache-Control", "public, max-age=3600");
  return headers;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id || !ID_RE.test(id)) return new Response("Invalid id", { status: 400 });

  const song = await loadSharedSong(id);
  if (!song) return new Response("Not found", { status: 404 });

  // Fast path: proxy the pre-generated preview clip.
  if (song.previewAudioUrl) {
    try {
      const upstream = await fetch(song.previewAudioUrl, { cache: "no-store" });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, { status: 200, headers: streamHeaders() });
      }
    } catch {
      // fall through to lazy generation
    }
  }

  // Legacy path: generate the preview from whatever source we have. Never the
  // full song — renderPreviewFromFile caps output at PREVIEW_SEC.
  const sourceUrl = song.highlightAudioUrl ?? song.audioUrl ?? song.fullAudioUrl;
  if (!sourceUrl) return new Response("No audio", { status: 404 });

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), "smb-prevroute-"));
    const srcPath = path.join(workDir, `src-${randomUUID()}.mp3`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(sourceUrl, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) return new Response("Upstream unavailable", { status: 502 });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return new Response("Empty audio", { status: 502 });
      await writeFile(srcPath, buf);
    } finally {
      clearTimeout(timeout);
    }

    const previewBuf = await renderPreviewFromFile(srcPath, 0, PREVIEW_SEC);
    if (!previewBuf) return new Response("Preview render failed", { status: 500 });

    // Best-effort persist so subsequent hits take the fast path.
    void (async () => {
      try {
        const url = await uploadToR2(`audio/${id}-preview.mp3`, previewBuf, "audio/mpeg");
        await updateSharedSong(id, { previewAudioUrl: url });
      } catch {
        // non-fatal — we already have the bytes to serve this request
      }
    })();

    return new Response(new Uint8Array(previewBuf), { status: 200, headers: streamHeaders() });
  } catch (err) {
    console.error(`[share-preview] failed id=${id}`, err);
    return new Response("Preview unavailable", { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
