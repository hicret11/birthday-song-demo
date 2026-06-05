import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { readWindowedStat } from "@/lib/venue-stats";
import { HEX_COLOR_RE, SLUG_RE } from "@/lib/venues";
import ManageForm from "./ManageForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ portal_error?: string }>;
};

type ManageVenue = {
  venue_name: string;
  logo_color: string;
  share_slug: string;
  subscription_status: string;
  past_due_since: string | null;
  email: string | null;
};

const FALLBACK_COLOR = "#a855f7";

async function loadManageableVenue(rawSlug: string): Promise<ManageVenue | null> {
  const slug = rawSlug.toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("venues")
      .select("venue_name, logo_color, share_slug, subscription_status, past_due_since, email")
      .eq("share_slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    // We render the manage page for ANY status that still has a venue row —
    // active, past_due, canceled, etc. Cancellation flow may need to surface
    // "your subscription has ended" copy from this same page later.
    if (!data.venue_name || !data.share_slug) return null;
    return data as ManageVenue;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await loadManageableVenue(slug);
  if (!venue) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `Manage — ${venue.venue_name}`,
    robots: { index: false, follow: false },
  };
}

function statusLabel(status: string): { label: string; cls: string } {
  switch (status) {
    case "active":
      return { label: "Active", cls: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" };
    case "trialing":
      return { label: "Trialing", cls: "border-sky-300/30 bg-sky-300/10 text-sky-200" };
    case "past_due":
      return { label: "Past due", cls: "border-amber-300/40 bg-amber-300/10 text-amber-200" };
    case "canceled":
      return { label: "Canceled", cls: "border-rose-300/30 bg-rose-300/10 text-rose-200" };
    default:
      return { label: status, cls: "border-white/15 bg-white/5 text-gray-200" };
  }
}

export default async function ManagePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { portal_error } = await searchParams;
  const venue = await loadManageableVenue(slug);
  if (!venue) notFound();

  const brand = HEX_COLOR_RE.test(venue.logo_color) ? venue.logo_color : FALLBACK_COLOR;
  const status = statusLabel(venue.subscription_status);
  const brandedUrl = `https://singmybirthday.com/v/${venue.share_slug}`;

  const [pageViews, captures] = await Promise.all([
    readWindowedStat("page-view", venue.share_slug),
    readWindowedStat("capture", venue.share_slug),
  ]);

  const errorBanner = portal_error
    ? portal_error === "expired"
      ? "That link has expired or was already used. Request a fresh one below."
      : "Something went wrong opening the billing portal. Try again in a minute."
    : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-5 py-12 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${brand}22 0%, transparent 55%), radial-gradient(circle at 50% 100%, ${brand}18 0%, transparent 55%)`,
        }}
      />

      <section className="relative z-10 mx-auto w-full max-w-xl">
        <Link
          href={`/v/${encodeURIComponent(venue.share_slug)}`}
          className="text-xs text-gray-400 hover:text-white"
        >
          ← Back to {venue.venue_name}
        </Link>

        <h1
          className="mt-3 text-3xl font-extrabold leading-tight"
          style={{ color: brand }}
        >
          {venue.venue_name}
        </h1>
        <p className="mt-1 text-sm text-gray-300">Manage your subscription</p>

        {errorBanner && (
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100">
            {errorBanner}
          </div>
        )}

        {/* Branded link card */}
        <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Your branded link</p>
          <p className="mt-2 break-all font-mono text-sm">{brandedUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={brandedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
            >
              Open ↗
            </a>
            <span className="rounded-full px-3 py-1.5 text-xs font-bold border border-white/15 bg-white/5">
              Slug: <code className="ml-1 font-mono">{venue.share_slug}</code>
            </span>
          </div>
        </div>

        {/* Stats card */}
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Last 30 days</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="text-3xl font-extrabold" style={{ color: brand }}>
                {pageViews.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">page views</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold" style={{ color: brand }}>
                {captures.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">birthday songs created</p>
            </div>
          </div>
        </div>

        {/* Billing card */}
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Billing</p>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-300">
            Update your card, see invoices, or cancel — all in the secure Stripe billing portal.
          </p>
          <div className="mt-4">
            <ManageForm slug={venue.share_slug} brand={brand} />
          </div>
        </div>

        <footer className="mt-10 text-center text-[11px] text-gray-500">
          Sing My Birthday <span className="text-gray-700">·</span> A glomotec Labs product
        </footer>
      </section>
    </main>
  );
}
