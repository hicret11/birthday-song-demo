import { env } from "./env";

export type SunoSubmitInput = {
  lyrics: string;
  style: string;
  title: string;
};

export type SunoStatus =
  | { status: "pending"; progress?: number }
  | { status: "complete"; audioUrl: string; durationSec?: number }
  | { status: "failed"; error: string };

type SunoEnvelope<T> = {
  code: number;
  msg?: string;
  data?: T;
};

type SunoSubmitData = {
  taskId: string;
};

type SunoTrack = {
  id?: string;
  audioUrl?: string;
  streamAudioUrl?: string;
  sourceAudioUrl?: string;
  duration?: number;
};

type SunoStatusData = {
  taskId: string;
  status: string;
  response?: { sunoData?: SunoTrack[] };
  errorCode?: number | string;
  errorMessage?: string;
};

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${env.sunoApiKey}`,
    "Content-Type": "application/json",
  };
}

const CALLBACK_PLACEHOLDER = "https://example.com/callback";

export async function submitGeneration(input: SunoSubmitInput): Promise<string> {
  const body: Record<string, unknown> = {
    customMode: true,
    instrumental: false,
    prompt: input.lyrics,
    style: input.style,
    title: input.title,
    model: env.sunoModel,
    callBackUrl: env.sunoCallbackUrl || CALLBACK_PLACEHOLDER,
  };

  const res = await fetch(`${env.sunoApiBaseUrl}/api/v1/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Suno submit failed (${res.status}): ${text.slice(0, 500)}`);
  }

  let envelope: SunoEnvelope<SunoSubmitData>;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`Suno submit returned non-JSON response: ${text.slice(0, 500)}`);
  }

  if (envelope.code !== 200 || !envelope.data?.taskId) {
    throw new Error(`Suno submit rejected: code=${envelope.code} msg=${envelope.msg ?? "unknown"}`);
  }

  return envelope.data.taskId;
}

const PENDING_STATUSES = new Set([
  "PENDING",
  "TEXT_SUCCESS",
  "FIRST_SUCCESS",
  "PROCESSING",
  "QUEUED",
]);

const COMPLETE_STATUSES = new Set(["SUCCESS"]);

const FAILED_STATUSES = new Set([
  "CREATE_TASK_FAILED",
  "GENERATE_AUDIO_FAILED",
  "CALLBACK_EXCEPTION",
  "SENSITIVE_WORD_ERROR",
  "FAILED",
  "ERROR",
]);

export async function checkStatus(jobId: string): Promise<SunoStatus> {
  const url = new URL(`${env.sunoApiBaseUrl}/api/v1/generate/record-info`);
  url.searchParams.set("taskId", jobId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Suno status failed (${res.status}): ${text.slice(0, 500)}`);
  }

  let envelope: SunoEnvelope<SunoStatusData>;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`Suno status returned non-JSON response: ${text.slice(0, 500)}`);
  }

  if (envelope.code !== 200 || !envelope.data) {
    throw new Error(`Suno status rejected: code=${envelope.code} msg=${envelope.msg ?? "unknown"}`);
  }

  const data = envelope.data;
  const upperStatus = data.status?.toUpperCase() ?? "";

  if (COMPLETE_STATUSES.has(upperStatus)) {
    const track = data.response?.sunoData?.find((t) => t.audioUrl);
    if (!track?.audioUrl) {
      return { status: "pending" };
    }
    return {
      status: "complete",
      audioUrl: track.audioUrl,
      durationSec: typeof track.duration === "number" ? track.duration : undefined,
    };
  }

  if (FAILED_STATUSES.has(upperStatus)) {
    return {
      status: "failed",
      error: data.errorMessage ?? `Generation failed (${upperStatus})`,
    };
  }

  if (PENDING_STATUSES.has(upperStatus) || upperStatus === "") {
    return { status: "pending" };
  }

  return { status: "pending" };
}
