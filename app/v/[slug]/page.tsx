import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recordVenueStat } from "@/lib/venue-stats";
import { HEX_COLOR_RE, loadActiveVenue } from "@/lib/venues";
import TrackVenueView from "./TrackVenueView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const FALLBACK_COLOR = "#1f8e7d"; // jade — warm-system default when a venue has no valid brand color

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await loadActiveVenue(slug);
  if (!venue) {
    return {
      title: "Not found",
      description: "This venue page is unavailable.",
      robots: { index: false, follow: false },
    };
  }
  const title = `${venue.venue_name} — Birthday Songs`;
  const description = `Make a personalized birthday song with ${venue.venue_name}. Any language, any style, ready in about a minute.`;
  const canonical = `/v/${venue.share_slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: "Sing My Birthday",
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function VenuePage({ params }: PageProps) {
  const { slug } = await params;
  const venue = await loadActiveVenue(slug);
  if (!venue) notFound();

  // Best-effort daily page-view counter for the manage-page stats panel.
  void recordVenueStat("page-view", venue.share_slug);

  const brand = HEX_COLOR_RE.test(venue.logo_color) ? venue.logo_color : FALLBACK_COLOR;
  const generateHref = `/generate?venue=${encodeURIComponent(venue.share_slug)}`;
  const isPastDue = venue.subscription_status === "past_due";
  const manageUrl = `/v/${encodeURIComponent(venue.share_slug)}/manage`;

  return (
    <main className="grain relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-5 py-16 text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />

      <TrackVenueView slug={venue.share_slug} venue_name={venue.venue_name} />

      {isPastDue && (
        <div className="relative z-20 mx-auto mb-6 w-full max-w-md rounded-2xl border border-sand bg-cream-soft px-4 py-3 text-center text-sm font-semibold text-ink">
          ⚠️ Subscription needs attention —{" "}
          <Link href={manageUrl} className="text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade">
            update payment
          </Link>
        </div>
      )}

      <section className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center text-center">
        <h1
          className="text-[clamp(40px,11vw,80px)] font-extrabold leading-[1.05] tracking-tight"
          style={{ color: brand }}
        >
          {venue.venue_name}
        </h1>

        <p className="mt-5 text-[clamp(16px,4vw,20px)] text-ink-soft">
          Make a personalized birthday song.
        </p>

        <Link
          href={generateHref}
          className="mt-12 inline-flex w-full items-center justify-center rounded-2xl px-8 py-6 text-[clamp(16px,4vw,20px)] font-extrabold text-white shadow-2xl transition hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]"
          style={{
            backgroundColor: brand,
            boxShadow: `0 20px 50px -15px ${brand}80`,
          }}
        >
          Create a Birthday Song
        </Link>

        <p className="mt-4 text-xs text-ink-soft">Free · takes about a minute</p>
      </section>

      <footer className="relative z-10 mt-20 text-center text-[11px] text-ink-soft">
        <Link href="/" className="text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade">
          Powered by Sing My Birthday
        </Link>
      </footer>
    </main>
  );
}
