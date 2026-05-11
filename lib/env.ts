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
  get anthropicApiKey(): string {
    return required("ANTHROPIC_API_KEY");
  },
  get anthropicModel(): string {
    return optional("ANTHROPIC_MODEL", "claude-sonnet-4-6");
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
