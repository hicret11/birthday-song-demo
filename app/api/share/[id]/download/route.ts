// Force-download endpoint for the share artifact.
//
// Why a server route instead of linking the R2 URL directly with the HTML
// `download` attribute:
//   - iOS Safari ignores `download` on cross-origin links — it opens MP4s in
//     a native player tab and offers no "save" UX.
//   - Setting `Content-Disposition: attachment` server-side is the one
//     mechanism that works on every browser, including iOS Safari.

import { after } from "next/server";
import { logGenerationEvent } from "@/lib/events";
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

  // Paywall enforcement: downloads (full song + video) are a paid entitlement.
  // A locked song exposes only the gated 15s preview route, never this endpoint.
  // 402 Payment Required is the honest status.
  if (!song.unlocked) {
    return new Response("Unlock required", { status: 402 });
  }

  // Best-effort durable event — never blocks the download.
  after(
    logGenerationEvent("download_requested", request, {
      shareId: id,
      venueSlug: song.venueSlug,
      recipientName: song.name,
      language: song.language,
      genre: song.genre,
    }),
  );

  // Prefer the muxed share video; else the full-length song (persisted to R2 —
  // Standard delivers the complete track), else the raw Suno audio as a last
  // resort. The highlight cut is only ever used for the preview + video source,
  // never as the buyer's downloaded song.
  const hasVideo = typeof song.videoUrl === "string" && song.videoUrl.length > 0;
  const audioFallback = song.fullAudioUrl ?? song.audioUrl;
  const sourceUrl = hasVideo ? (song.videoUrl as string) : audioFallback;
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
