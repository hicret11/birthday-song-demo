import { ApiError, ApiErrorCode } from "@/lib/api-types";
import { loadSharedSong } from "@/lib/share";

export const runtime = "nodejs";
export const maxDuration = 10;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id) {
    return errorResponse("INVALID_INPUT", "Share id is required.", 400);
  }

  try {
    const song = await loadSharedSong(id);
    if (!song) {
      return errorResponse("NOT_FOUND", "Share link not found or expired.", 404);
    }
    return Response.json(song);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown share lookup error";
    console.error("[share-get] failed:", message);
    return errorResponse("SHARE_STORE_FAILED", "Couldn't load shared song. Please try again.", 502);
  }
}
