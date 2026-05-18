import {
  ApiError,
  ApiErrorCode,
  RenderPreviewRequest,
  RenderPreviewResponse,
  SHARE_TEMPLATES,
  ShareTemplate,
} from "@/lib/api-types";
import { renderAndCachePreview } from "@/lib/preview";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_NAME_LEN = 80;

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

function isValidAudioUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidTemplate(value: unknown): value is ShareTemplate {
  return typeof value === "string" && (SHARE_TEMPLATES as readonly string[]).includes(value);
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<RenderPreviewRequest>;
  try {
    body = (await request.json()) as Partial<RenderPreviewRequest>;
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }

  if (!isValidAudioUrl(body.audioUrl)) {
    return errorResponse("INVALID_INPUT", "audioUrl must be a valid http(s) URL.", 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return errorResponse("INVALID_INPUT", "Name is required.", 400);
  if (name.length > MAX_NAME_LEN) {
    return errorResponse("INVALID_INPUT", `Name must be ${MAX_NAME_LEN} chars or fewer.`, 400);
  }
  if (!isValidTemplate(body.template)) {
    return errorResponse("INVALID_INPUT", "Unknown template.", 400);
  }

  try {
    const videoUrl = await renderAndCachePreview({
      audioUrl: body.audioUrl,
      name,
      template: body.template,
    });
    const response: RenderPreviewResponse = { videoUrl };
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview render failed";
    console.error("[render-preview] failed:", message);
    return errorResponse("VIDEO_RENDER_FAILED", message, 502);
  }
}
