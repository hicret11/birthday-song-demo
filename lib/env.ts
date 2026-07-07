function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  // OpenAI powers lyric generation + style refinement (and moderation/Whisper).
  get openaiApiKey(): string {
    return required("OPENAI_API_KEY");
  },
  // Lyrics: a stronger model for better instruction-following + JSON reliability.
  get openaiLyricsModel(): string {
    return optional("OPENAI_LYRICS_MODEL", "gpt-5-mini");
  },
  // Style-refine: a cheaper model with the web_search tool for niche references.
  get openaiRefineModel(): string {
    return optional("OPENAI_REFINE_MODEL", "gpt-5-mini");
  },
  get sunoApiKey(): string {
    return required("SUNO_API_KEY");
  },
  get sunoApiBaseUrl(): string {
    return optional("SUNO_API_BASE_URL", "https://api.sunoapi.org");
  },
  get sunoModel(): string {
    return optional("SUNO_MODEL", "V4");
  },
  get sunoCallbackUrl(): string {
    return process.env.SUNO_CALLBACK_URL?.trim() ?? "";
  },
 
};
