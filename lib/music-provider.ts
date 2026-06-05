// Music-generation provider abstraction. Today there's one provider (Suno);
// the seams here exist so a second provider (Replicate Riffusion, Stability
// Audio, a self-hosted MusicGen, etc.) can plug in with a routing decision.
//
// The active provider is selected per-request via getMusicProvider(). When
// adding a second provider, return a different implementation here based on
// some signal (env flag, A/B bucket, recent failure pattern).

import { kv } from "@vercel/kv";
import {
  checkStatus as sunoCheckStatus,
  submitGeneration as sunoSubmit,
  type SunoStatus,
  type SunoSubmitInput,
} from "./suno";

export type MusicProvider = {
  /** Human-readable name for logs / metrics. */
  readonly name: string;
  /** Submit a generation job; returns provider's job id. */
  submit(input: SunoSubmitInput): Promise<string>;
  /** Poll job status. */
  checkStatus(jobId: string): Promise<SunoStatus>;
};

const sunoProvider: MusicProvider = {
  name: "suno",
  submit: sunoSubmit,
  checkStatus: sunoCheckStatus,
};

export function getMusicProvider(): MusicProvider {
  // When alternates are added, branch here. Today: just Suno.
  return sunoProvider;
}

// ── Circuit breaker for the active provider ──────────────────────────────────
// If submit() fails consecutively N times within COOLDOWN_SECONDS, we mark
// the provider unhealthy and short-circuit further submits until cooldown
// elapses. This prevents pinging a dead upstream during an outage and lets
// us return a friendly message instead of stack traces.

const BREAKER_KEY = (name: string) => `music:breaker:${name}`;
const FAILURE_THRESHOLD = 2;
const COOLDOWN_SECONDS = 5 * 60;

export type BreakerState = {
  open: boolean; // true = short-circuit further calls
  consecutiveFailures: number;
};

async function readBreaker(provider: string): Promise<number> {
  try {
    const raw = await kv.get<number | string>(BREAKER_KEY(provider));
    if (raw == null) return 0;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function isProviderOpen(provider: string): Promise<BreakerState> {
  const consecutiveFailures = await readBreaker(provider);
  return { open: consecutiveFailures >= FAILURE_THRESHOLD, consecutiveFailures };
}

export async function noteProviderFailure(provider: string): Promise<number> {
  try {
    const total = await kv.incr(BREAKER_KEY(provider));
    if (total === 1) {
      await kv.expire(BREAKER_KEY(provider), COOLDOWN_SECONDS);
    }
    return total;
  } catch {
    return 0;
  }
}

export async function noteProviderSuccess(provider: string): Promise<void> {
  try {
    await kv.del(BREAKER_KEY(provider));
  } catch {
    // Best-effort reset; on KV failure the breaker will time out on its own.
  }
}

/**
 * Classify a thrown error as a transient upstream failure (worth tripping
 * the breaker) vs. a permanent one (bad input, etc.). Today only the
 * 5xx/timeout signals from lib/suno.ts qualify.
 */
export function isTransientUpstreamError(message: string): boolean {
  if (/timeout|aborted|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return true;
  }
  // lib/suno.ts throws "Suno submit failed (NNN): ..." for non-2xx responses.
  const m = message.match(/\b(5\d{2})\b/);
  if (m) return true;
  return false;
}
