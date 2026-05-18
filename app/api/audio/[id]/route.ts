// Proxy Suno tempfile audio through our own origin so the browser doesn't
// have to trust tempfile.aiquickdraw.com's cert chain.

export const runtime = "nodejs";
export const maxDuration = 60;

const SUNO_TEMPFILE_BASE = "https://tempfile.aiquickdraw.com/r";
const ID_PATTERN = /^[a-f0-9]{32}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return new Response("Invalid audio id", { status: 400 });
  }

  const forwardHeaders: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) forwardHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(`${SUNO_TEMPFILE_BASE}/${id}.mp3`, {
      cache: "no-store",
      headers: forwardHeaders,
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (upstream.status >= 400) {
    return new Response("Upstream audio not available", { status: upstream.status });
  }
  if (!upstream.body) {
    return new Response("Upstream returned no body", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=3600");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new Response(upstream.body, { status: upstream.status, headers });
}
