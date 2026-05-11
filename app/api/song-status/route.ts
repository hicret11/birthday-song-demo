import type { NextRequest } from "next/server";
import { ApiError, ApiErrorCode, SongStatusResponse } from "@/lib/api-types";
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
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown music status error";
    console.error("[song-status] failed:", message);
    return errorResponse("MUSIC_STATUS_FAILED", "Couldn't reach music service. Please retry.", 502);
  }
}
