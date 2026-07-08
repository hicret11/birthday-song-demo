import { loadActiveVenue } from "@/lib/venues";
import { isLocale, type Locale } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/server";
import GeneratorClient, { type VenueContext } from "./GeneratorClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ venue?: string | string[]; lang?: string | string[] }>;
};

export default async function GeneratePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.venue;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  // `?lang=` deep-link override takes precedence over the resolved locale
  // (cookie / Accept-Language), mirroring the landing page behaviour.
  const rawLang = params.lang;
  const langParam = typeof rawLang === "string" ? rawLang : Array.isArray(rawLang) ? rawLang[0] : undefined;
  const locale: Locale = isLocale(langParam) ? langParam : await resolveLocale();

  let venue: VenueContext | null = null;
  if (slug) {
    const resolved = await loadActiveVenue(slug);
    if (resolved) {
      venue = {
        name: resolved.venue_name,
        logo_color: resolved.logo_color,
        slug: resolved.share_slug,
      };
    }
  }

  return <GeneratorClient venue={venue} locale={locale} />;
}
