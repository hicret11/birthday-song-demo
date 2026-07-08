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
        <h1 className="font-display text-2xl font-bold text-ink">Payment incomplete</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your checkout shows status <code className="rounded bg-sand px-1.5 py-0.5">{session.payment_status}</code>.
          Restart from{" "}
          <Link href="/become-a-venue" className="text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade">become a venue</Link>.
        </p>
      </Shell>
    );
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (!customerId) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold text-ink">Hmm, something&apos;s missing.</h1>
        <p className="mt-2 text-sm text-ink-soft">Your session is paid but we couldn&apos;t find the customer record. Email us and we&apos;ll fix it.</p>
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
        <h1 className="font-display text-3xl font-extrabold text-ink">You&apos;re all set 🎉</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Your branded venue page lives at{" "}
          <code className="rounded bg-sand px-1.5 py-0.5">/v/{venue.share_slug}</code>.
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Your link is live now — share it with your guests anytime.
        </p>
      </Shell>
    );
  }

  const defaultName = session.customer_details?.name ?? "";

  return (
    <Shell>
      <h1 className="font-display text-3xl font-extrabold text-ink">Welcome aboard.</h1>
      <p className="mt-2 text-sm text-ink-soft">
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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-4 py-12 text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />
      <section className="relative z-10 mx-auto w-full max-w-md rounded-3xl border border-sand bg-cream-soft p-8 shadow-sm">
        {children}
      </section>
    </main>
  );
}
