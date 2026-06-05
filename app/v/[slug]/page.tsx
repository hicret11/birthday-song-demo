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

const FALLBACK_COLOR = "#a855f7";

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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-5 py-16 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${brand}22 0%, transparent 55%), radial-gradient(circle at 50% 100%, ${brand}18 0%, transparent 55%)`,
        }}
      />

      <TrackVenueView slug={venue.share_slug} venue_name={venue.venue_name} />

      {isPastDue && (
        <div className="relative z-20 mx-auto mb-6 w-full max-w-md rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-center text-sm font-semibold text-amber-100">
          ⚠️ Subscription needs attention —{" "}
          <Link href={manageUrl} className="underline underline-offset-2 hover:text-white">
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

        <p className="mt-5 text-[clamp(16px,4vw,20px)] text-gray-200">
          Make a personalized birthday song.
        </p>

        <Link
          href={generateHref}
          className="mt-12 inline-flex w-full items-center justify-center rounded-2xl px-8 py-6 text-[clamp(16px,4vw,20px)] font-extrabold text-white shadow-2xl transition hover:-translate-y-1 active:translate-y-0"
          style={{
            backgroundColor: brand,
            boxShadow: `0 20px 50px -15px ${brand}80`,
          }}
        >
          Create a Birthday Song
        </Link>

        <p className="mt-4 text-xs text-gray-400">Free · takes about a minute</p>
      </section>

      <footer className="relative z-10 mt-20 text-center text-[11px] text-gray-500">
        <Link href="/" className="hover:text-gray-300 hover:underline underline-offset-2">
          Powered by Sing My Birthday
        </Link>
      </footer>
    </main>
  );
}
