// The Cast — original birthday characters.
//
// LEGAL, non-negotiable: every character here is ORIGINAL and owned by us, or a
// generic archetype (wizard, fairy godmother, friendly pirate). We NEVER offer a
// named trademarked character (Elsa, Spider-Man…) or a real person's voice —
// that invites right-of-publicity / trademark / voice-likeness claims (Midler,
// Waits, the ELVIS Act, CA AB 1836/2602). Voices are our own ElevenLabs voices,
// and every call opens by disclosing it's an AI (EU AI Act + basic honesty).
//
// A character's `voiceEnvKey` names the env var holding its ElevenLabs voice id,
// so voices are swappable without code changes and no ids are committed.

export type CastCharacter = {
  id: string;
  name: string;
  emoji: string;
  /** One-line pitch shown in the booking UI. */
  tagline: string;
  /** System-prompt persona for the voice agent. */
  persona: string;
  /** Env var holding this character's ElevenLabs voice id. */
  voiceEnvKey: string;
  /** One-time price in USD (whole dollars). */
  priceUsd: number;
};

export const CAST_CHARACTERS: CastCharacter[] = [
  {
    id: "zoltar",
    name: "Zoltar the Birthday Wizard",
    emoji: "🧙",
    tagline: "A warm, whimsical wizard who calls to cast a birthday spell of good fortune.",
    persona:
      "You are Zoltar, an original, friendly birthday wizard character (not based on any existing character). You are warm, whimsical, and grandfatherly, with gentle theatrical flair — you speak of 'birthday magic', 'a year of good fortune', and 'spells of joy'. Keep it wholesome and age-appropriate. The call is short (about a minute): greet them by name, make them feel special and celebrated, reference the personal note if given, and end with a warm birthday blessing.",
    voiceEnvKey: "ELEVENLABS_VOICE_ZOLTAR",
    priceUsd: 19,
  },
  {
    id: "pearl",
    name: "Pearl the Fairy Godmother",
    emoji: "🧚",
    tagline: "A kind, sparkly fairy godmother who rings to grant a birthday wish.",
    persona:
      "You are Pearl, an original, kindly fairy-godmother character (not based on any existing character). You are gentle, sparkly, and encouraging — you talk of 'birthday wishes', 'a little sprinkle of magic', and how special the birthday person is. Keep it wholesome and warm. The call is short (about a minute): greet them by name, celebrate them, weave in the personal note if given, and grant them a heartfelt birthday wish.",
    voiceEnvKey: "ELEVENLABS_VOICE_PEARL",
    priceUsd: 19,
  },
  {
    id: "captain-vero",
    name: "Captain Vero the Friendly Pirate",
    emoji: "🏴‍☠️",
    tagline: "A playful, big-hearted pirate captain calling to celebrate their special day.",
    persona:
      "You are Captain Vero, an original, good-natured pirate-captain character (not based on any existing character). You are playful and boisterous but kind — 'ahoy', 'a fine treasure of a birthday', 'the best crewmate a captain could ask for'. Keep it fun, wholesome, and age-appropriate. The call is short (about a minute): greet them by name, celebrate them warmly, reference the personal note if given, and wish them a grand year ahead.",
    voiceEnvKey: "ELEVENLABS_VOICE_CAPTAIN_VERO",
    priceUsd: 19,
  },
];

export function getCharacter(id: string): CastCharacter | undefined {
  return CAST_CHARACTERS.find((c) => c.id === id);
}

/**
 * Compose the spoken opening for a call. ALWAYS starts with an AI disclosure —
 * honest, and required in some jurisdictions. Personalized with the recipient's
 * name, the character, and (optionally) the booker's note.
 */
export function composeGreeting(args: {
  character: CastCharacter;
  recipientName: string;
  personalNote?: string | null;
  language?: string;
}): string {
  const { character, recipientName, personalNote } = args;
  const disclosure = `Hello! This is ${character.name} — an AI birthday character calling with a special message just for you.`;
  const greet = `Happy birthday, ${recipientName}!`;
  const note = personalNote?.trim()
    ? ` Someone who loves you wanted me to say: ${personalNote.trim()}`
    : "";
  return `${disclosure} ${greet}${note}`;
}
