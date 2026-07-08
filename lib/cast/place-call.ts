// Place the AI character birthday call — server-only.
//
// Bridges a cast booking to ElevenLabs' conversational voice agent over Twilio.
// Entirely env-gated and best-effort, mirroring lib/render-video.ts: when the
// ElevenLabs/Twilio env isn't configured it's a NO-OP (booking stays "pending",
// nothing breaks), so the rest of the product is unaffected until the cast is
// switched on. Never throws.
//
// Integration note: the request body matches the documented ElevenLabs convai
// Twilio outbound-call endpoint (validated against the API reference + the
// conversation_config_override schema, Jul 2026). Two things must be set up on
// the ElevenLabs side for it to take full effect:
//   1. The agent must ALLOW overrides (Agent → Security → Overrides) for
//      first_message, system prompt, language, and voice — we send those via
//      conversation_config_override so the AI disclosure + persona + per-character
//      voice apply regardless of the agent's default template.
//   2. A Twilio number must be registered with the agent (agent_phone_number_id).
// The greeting we force as `first_message` ALWAYS opens with the AI disclosure
// (composeGreeting), so the legal disclosure can't be skipped by agent config.
// Failure is caught and recorded on the booking, never surfaced mid-flow.

import type { CastBooking } from "../cast";
import { updateBookingStatus } from "../cast";
import { getCharacter, composeGreeting, type CastCharacter } from "./characters";

const ELEVEN_OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";
const REQUEST_TIMEOUT_MS = 20_000;

// Full language name (as stored on a booking) → ElevenLabs agent language code.
// Only override the agent language when we have a mapping; otherwise omit it
// (the docs: "omit any fields you don't want to override").
const LANGUAGE_CODE: Record<string, string> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
  French: "fr",
  German: "de",
  Portuguese: "pt",
  Italian: "it",
  Hindi: "hi",
};

export type PlaceCallResult = { placed: boolean; reason?: string };

/** The full spoken brief handed to the voice agent for one call. */
export function composeCallScript(
  booking: CastBooking,
  character: CastCharacter,
): { greeting: string; persona: string } {
  return {
    greeting: composeGreeting({
      character,
      recipientName: booking.recipientName,
      personalNote: booking.personalNote,
      language: booking.language,
    }),
    persona: character.persona,
  };
}

function callEnv(): {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
} | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !agentPhoneNumberId) return null;
  return { apiKey, agentId, agentPhoneNumberId };
}

/**
 * Is outbound telephony configured? The scheduler checks this first so that,
 * with no ElevenLabs/Twilio creds, it's a clean no-op — it never claims or
 * mutates a booking, leaving them "scheduled" to retry once creds are added.
 */
export function isTelephonyConfigured(): boolean {
  return callEnv() !== null;
}

/**
 * Place the call for a booking. No-op (placed:false) when telephony env is
 * absent or the booking isn't a phone-callable ai_call with a number. On a real
 * attempt, flips the booking to "calling" (or "failed"). Never throws.
 */
export async function placeCall(booking: CastBooking): Promise<PlaceCallResult> {
  try {
    if (booking.kind !== "ai_call") return { placed: false, reason: "not an ai_call booking" };
    if (!booking.recipientPhone) return { placed: false, reason: "no recipient phone" };

    const character = getCharacter(booking.characterId);
    if (!character) return { placed: false, reason: `unknown character ${booking.characterId}` };

    const env = callEnv();
    if (!env) {
      // Telephony not configured — leave the booking pending; nothing breaks.
      return { placed: false, reason: "telephony env not configured" };
    }

    const voiceId = character.voiceEnvKey ? process.env[character.voiceEnvKey] : undefined;
    const { greeting, persona } = composeCallScript(booking, character);
    const languageCode = LANGUAGE_CODE[booking.language];

    // conversation_config_override: force the spoken experience per call so it
    // applies regardless of the agent's default template. Build the `agent`
    // block (always) and the `tts` block (only when a voice is configured);
    // omit fields we don't want to override, per the ElevenLabs docs.
    const agentOverride: {
      first_message: string;
      prompt: { prompt: string };
      language?: string;
    } = {
      first_message: greeting, // ALWAYS opens with the AI disclosure
      prompt: { prompt: persona },
    };
    if (languageCode) agentOverride.language = languageCode;

    const conversationConfigOverride: {
      agent: typeof agentOverride;
      tts?: { voice_id: string };
    } = { agent: agentOverride };
    if (voiceId) conversationConfigOverride.tts = { voice_id: voiceId };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(ELEVEN_OUTBOUND_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": env.apiKey,
        },
        body: JSON.stringify({
          agent_id: env.agentId,
          agent_phone_number_id: env.agentPhoneNumberId,
          to_number: booking.recipientPhone,
          // Personalize the single shared agent per call: config overrides drive
          // the disclosure/persona/voice; dynamic_variables mirror the same
          // values for any agent template that references {{greeting}} etc.
          conversation_initiation_client_data: {
            conversation_config_override: conversationConfigOverride,
            dynamic_variables: {
              character_name: character.name,
              recipient_name: booking.recipientName,
              greeting,
              persona,
              personal_note: booking.personalNote ?? "",
              language: booking.language,
            },
          },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        await updateBookingStatus(booking.id, "failed", `elevenlabs ${res.status}: ${detail.slice(0, 200)}`);
        return { placed: false, reason: `elevenlabs responded ${res.status}` };
      }
      await updateBookingStatus(booking.id, "calling", "outbound call initiated");
      return { placed: true };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cast:place-call] failed:", msg);
    try {
      await updateBookingStatus(booking.id, "failed", msg.slice(0, 200));
    } catch {
      // give up quietly
    }
    return { placed: false, reason: msg };
  }
}
