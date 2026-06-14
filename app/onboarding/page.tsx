import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import OnboardingForm from "./OnboardingForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome — set up your venue",
  // Private flow — only reachable via a successful Stripe Checkout redirect.
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function OnboardingPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  if (!session_id) redirect("/become-a-venue");

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch {
    redirect("/become-a-venue");
  }

  if (session.payment_status !== "paid") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Payment incomplete</h1>
        <p className="mt-2 text-sm text-gray-300">
          Your checkout shows status <code className="rounded bg-white/10 px-1.5 py-0.5">{session.payment_status}</code>.
          Restart from{" "}
          <Link href="/become-a-venue" className="underline">become a venue</Link>.
        </p>
      </Shell>
    );
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (!customerId) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Hmm, something's missing.</h1>
        <p className="mt-2 text-sm text-gray-300">Your session is paid but we couldn't find the customer record. Email us and we'll fix it.</p>
      </Shell>
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: venue } = await supabase
    .from("venues")
    .select("venue_name, logo_color, share_slug, subscription_status")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (venue?.share_slug) {
    return (
      <Shell>
        <h1 className="text-3xl font-extrabold">You're all set 🎉</h1>
        <p className="mt-3 text-sm text-gray-300">
          Your branded venue page lives at{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">/v/{venue.share_slug}</code>.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Your link is live now — share it with your guests anytime.
        </p>
      </Shell>
    );
  }

  const defaultName = session.customer_details?.name ?? "";

  return (
    <Shell>
      <h1 className="text-3xl font-extrabold">Welcome aboard.</h1>
      <p className="mt-2 text-sm text-gray-300">
        Two quick details so we can mint your branded link.
      </p>
      <div className="mt-6">
        <OnboardingForm sessionId={session_id} defaultName={defaultName} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.25),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(236,72,153,0.22),transparent_55%)]" />
      <section className="relative z-10 mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-8 shadow-2xl backdrop-blur-2xl">
        {children}
      </section>
    </main>
  );
}
