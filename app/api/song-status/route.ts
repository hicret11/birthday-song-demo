import { after } from "next/server";
import type { NextRequest } from "next/server";
import { ApiError, ApiErrorCode, SongStatusResponse } from "@/lib/api-types";
import { logGenerationEvent } from "@/lib/events";
import { checkStatus } from "@/lib/suno";

export const runtime = "nodejs";
export const maxDuration = 10;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function GET(request: NextRequest): Promise<Response> {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return errorResponse("MISSING_JOB_ID", "jobId query parameter is required.", 400);
  }

  try {
    const result: SongStatusResponse = await checkStatus(jobId);
    // Best-effort durable event on completion. The client polls and typically
    // stops on the first "complete", so this fires ~once; the append-only log
    // tolerates the rare duplicate. Minimal context here (job id + geo) — the
    // richly-joinable row is written at share creation.
    if (result.status === "complete") {
      after(
        logGenerationEvent("song_ready", request, {
          metadata: {
            job_id: jobId,
            ...(typeof result.durationSec === "number"
              ? { duration_seconds: result.durationSec }
              : {}),
          },
        }),
      );
    }
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown music status error";
    console.error("[song-status] failed:", message);
    return errorResponse("MUSIC_STATUS_FAILED", "Couldn't reach music service. Please retry.", 502);
  }
}
