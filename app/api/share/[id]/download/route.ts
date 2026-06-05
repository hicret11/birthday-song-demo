// Force-download endpoint for the share artifact.
//
// Why a server route instead of linking the R2 URL directly with the HTML
// `download` attribute:
//   - iOS Safari ignores `download` on cross-origin links — it opens MP4s in
//     a native player tab and offers no "save" UX.
//   - Setting `Content-Disposition: attachment` server-side is the one
//     mechanism that works on every browser, including iOS Safari.

import { loadSharedSong } from "@/lib/share";
import { slugify } from "@/lib/venues";

export const runtime = "nodejs";
export const maxDuration = 60;

const ID_RE = /^[a-zA-Z0-9]{1,32}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id || !ID_RE.test(id)) {
    return new Response("Invalid id", { status: 400 });
  }

  const song = await loadSharedSong(id);
  if (!song) return new Response("Not found", { status: 404 });

  // Prefer the muxed video; fall back to raw Suno audio when video render
  // failed at share-create time.
  const hasVideo = typeof song.videoUrl === "string" && song.videoUrl.length > 0;
  const sourceUrl = hasVideo ? (song.videoUrl as string) : song.audioUrl;
  const ext = hasVideo ? "mp4" : "mp3";
  const contentType = hasVideo ? "video/mp4" : "audio/mpeg";
  const nameSlug = slugify(song.name) || "song";
  const filename = `birthday-song-${nameSlug}.${ext}`;

  // Forward Range requests upstream so the platform can resume an
  // interrupted download instead of restarting from byte 0.
  const forwardHeaders: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) forwardHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      cache: "no-store",
      headers: forwardHeaders,
    });
  } catch (err) {
    console.error(`[share-download] upstream fetch failed id=${id}`, err);
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (upstream.status >= 400) {
    return new Response("Upstream not available", { status: upstream.status });
  }
  if (!upstream.body) {
    return new Response("Upstream returned no body", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  // RFC 5987 filename* fallback lets non-ASCII recipient names round-trip
  // cleanly through clients that respect it. Plain filename= for the
  // long-tail of legacy clients.
  headers.set(
    "Content-Disposition",
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  const cl = upstream.headers.get("content-length");
  if (cl) headers.set("Content-Length", cl);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(upstream.body, { status: upstream.status, headers });
}
