import { loadActiveVenue } from "@/lib/venues";
import GeneratorClient, { type VenueContext } from "./GeneratorClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ venue?: string | string[] }>;
};

export default async function GeneratePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.venue;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

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

  return <GeneratorClient venue={venue} />;
}
