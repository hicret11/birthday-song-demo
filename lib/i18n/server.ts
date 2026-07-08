// Server-only i18n helpers.
//
// Split out from ./index so the client-safe exports (dictionaries, types,
// getDictionary, isLocale, isRtl) can be imported by "use client" components
// WITHOUT dragging `next/headers` into the client bundle. Importing anything
// from a module that (transitively) imports next/headers into a client
// component fails the build ("This API is only available in Server
// Components"), which is exactly what happened via UnlockableAudio → @/lib/i18n.
//
// Anything that needs the request (cookies/headers) lives here and must only be
// imported from Server Components / route handlers.

import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./index";

const LOCALE_COOKIE = "lang";

/**
 * Parse an `Accept-Language` header and return the first supported locale.
 * Matches on the primary language subtag (e.g. "es-MX" -> "es").
 */
function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const parts = header
    .split(",")
    .map((part) => {
      const [tag, qRaw] = part.trim().split(";q=");
      const q = qRaw ? Number.parseFloat(qRaw) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((p) => p.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}

/**
 * Server helper. Resolves the active locale from the `lang` cookie, then the
 * `Accept-Language` header, falling back to DEFAULT_LOCALE. Query-param
 * override (`?lang=`) is handled by the caller (Server Component) which can
 * pass it through `searchParams`.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLang)) return cookieLang;

  const headerStore = await headers();
  const fromHeader = localeFromAcceptLanguage(headerStore.get("accept-language"));
  if (fromHeader) return fromHeader;

  return DEFAULT_LOCALE;
}
