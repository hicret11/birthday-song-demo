import type { ShareTemplate } from "./schema";

// Brand gradient anchors. Every theme leans on these three; per-theme tweaks
// shift accent + text treatment so templates stay visually distinct.
export const BRAND = {
  pink: "#ec4899",
  purple: "#a855f7",
  amber: "#f59e0b",
} as const;

// Deep brand base tone that sits under every background/photo layer so the
// palette can never drift toward green/blue.
export const BRAND_DARK = "#12062f";

// Fixed confetti palette — brand hues + white. Kept off the per-theme gradient
// so confetti stays on-brand regardless of the selected template.
export const CONFETTI_COLORS = [
  BRAND.pink,
  BRAND.purple,
  BRAND.amber,
  "#ffffff",
] as const;

export type ThemeTokens = {
  gradient: [string, string, string];
  accent: string; // waveform + highlight tint
  headlineColor: string;
  captionActive: string; // highlighted karaoke word
  captionIdle: string; // dimmed karaoke words
  strokeColor: string; // caption/headline outline
  fontFamily: string;
};

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const THEMES: Record<ShareTemplate, ThemeTokens> = {
  classic: {
    gradient: [BRAND.pink, BRAND.purple, BRAND.amber],
    accent: "#fbcfe8",
    headlineColor: "#fdf2f8",
    captionActive: "#ffffff",
    captionIdle: "rgba(253,242,248,0.55)",
    strokeColor: "#4a044e",
    fontFamily: SERIF,
  },
  neon: {
    gradient: ["#ff2bd6", BRAND.purple, "#3a0ca3"],
    accent: "#ff66ff",
    headlineColor: "#ff8bf0",
    captionActive: "#ffffff",
    captionIdle: "rgba(255,139,240,0.5)",
    strokeColor: "#2a0a3a",
    fontFamily: SANS,
  },
  elegant: {
    gradient: ["#b91c6b", "#7c3aed", BRAND.amber],
    accent: "#f5e070",
    headlineColor: "#f8e9a1",
    captionActive: "#fffbeb",
    captionIdle: "rgba(248,233,161,0.5)",
    strokeColor: "#1a1206",
    fontFamily: SERIF,
  },
  playful: {
    gradient: [BRAND.pink, "#c026d3", BRAND.amber],
    accent: "#fde68a",
    headlineColor: "#ffffff",
    captionActive: "#ffffff",
    captionIdle: "rgba(255,255,255,0.55)",
    strokeColor: "#111827",
    fontFamily: SANS,
  },
  corporate: {
    gradient: ["#db2777", "#7c3aed", "#d97706"],
    accent: "#e9d5ff",
    headlineColor: "#ffffff",
    captionActive: "#ffffff",
    captionIdle: "rgba(255,255,255,0.5)",
    strokeColor: "#0b1220",
    fontFamily: SANS,
  },
};

export function themeFor(theme: ShareTemplate): ThemeTokens {
  return THEMES[theme] ?? THEMES.classic;
}

// Localized "Happy Birthday" for the supported locales; English fallback.
// Keyed by both language name (Next app's LANGUAGES) and short code.
const HAPPY_BIRTHDAY: Record<string, string> = {
  english: "Happy Birthday",
  en: "Happy Birthday",
  spanish: "Feliz Cumpleaños",
  es: "Feliz Cumpleaños",
  turkish: "İyi ki Doğdun",
  tr: "İyi ki Doğdun",
  arabic: "عيد ميلاد سعيد",
  ar: "عيد ميلاد سعيد",
  french: "Joyeux Anniversaire",
  fr: "Joyeux Anniversaire",
};

export function happyBirthdayFor(language: string): string {
  const key = (language ?? "").toLowerCase().trim();
  return HAPPY_BIRTHDAY[key] ?? "Happy Birthday";
}

// RTL languages need the headline/captions mirrored.
export function isRtl(language: string): boolean {
  const key = (language ?? "").toLowerCase().trim();
  return key === "arabic" || key === "ar";
}
