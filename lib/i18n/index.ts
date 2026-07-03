// Lightweight, additive i18n foundation. Phase 1 covers the landing page only.
//
// Locale is resolved server-side, in priority order:
//   1. `lang` cookie (explicit user choice from the language switcher)
//   2. `?lang=` query param (deep-link / campaign override) — read by callers
//   3. `Accept-Language` request header (browser/Vercel geo preference)
//   4. DEFAULT_LOCALE ("en")
//
// No URL path segments (no `/es/`), so this is non-invasive and easy to remove.
//
// This module is CLIENT-SAFE: it must not import `next/headers` or any
// server-only API, because "use client" components import from it (types,
// dictionaries, getDictionary). The request-bound helper `resolveLocale` lives
// in ./server.ts — import it only from Server Components / route handlers.

import { en, type Dict } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { tr } from "./dictionaries/tr";
import { ar } from "./dictionaries/ar";

export type Locale = "en" | "es" | "tr" | "ar";

export const LOCALES: readonly Locale[] = ["en", "es", "tr", "ar"] as const;
export const DEFAULT_LOCALE: Locale = "en";

/** Locales that render right-to-left. */
const RTL_LOCALES: readonly Locale[] = ["ar"] as const;

/** Type guard: is `x` one of the supported locales? */
export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

/** Should this locale render right-to-left (e.g. Arabic)? */
export function isRtl(locale: Locale): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

const DICTIONARIES: Record<Locale, Dict> = { en, es, tr, ar };

/** Returns the typed dictionary for a locale (always falls back to a valid Dict). */
export function getDictionary(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export type { Dict };
