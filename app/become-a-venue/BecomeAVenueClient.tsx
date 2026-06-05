"use client";

import { useState } from "react";

export default function BecomeAVenueClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data?.error?.message ?? "Couldn't start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Please check your connection.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.25),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(236,72,153,0.22),transparent_55%)]" />

      <section className="relative z-10 mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-8 shadow-2xl backdrop-blur-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
          Founding Venue · Limited
        </span>

        <h1 className="mt-4 bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 bg-clip-text text-4xl font-extrabold leading-tight text-transparent">
          A branded birthday-song link for your venue.
        </h1>

        <p className="mt-3 text-sm text-gray-300">
          Founding venues get their own /v/[slug] landing page, brand color in the song flow, and attribution on every capture.
        </p>

        <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-3xl font-extrabold">$299<span className="text-base font-medium text-gray-300">/mo</span></p>
          <p className="mt-1 text-xs text-gray-400">Cancel anytime from the customer portal.</p>
        </div>

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 py-4 text-base font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {loading ? "Redirecting…" : "Become a founding venue"}
        </button>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>
        )}
      </section>
    </main>
  );
}
