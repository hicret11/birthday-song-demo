"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const VENUE_MAILTO =
  "mailto:founders@singmybirthday.com?subject=Venue%20interest%20%E2%80%94%20Sing%20My%20Birthday&body=Hi%20Sing%20My%20Birthday%20team%2C%0A%0AI%27d%20like%20to%20learn%20more%20about%20a%20branded%20venue%20link.%0A%0AVenue%20name%3A%0ACity%3A%0AWebsite%2FInstagram%3A%0A%0AThanks%21";

const STEPS = [
  {
    n: "1",
    title: "Get your branded link",
    body: "Your own singmybirthday.com/v/your-venue page plus a QR-ready link for tables, menus, and receipts.",
  },
  {
    n: "2",
    title: "Guests create a song",
    body: "A free, personalized birthday song in your brand color, with your venue woven through the flow. No app, no account.",
  },
  {
    n: "3",
    title: "Your brand travels",
    body: "Every song they share to WhatsApp, Telegram, and Stories carries your venue’s name — in front of all their friends.",
  },
];

const BENEFITS = [
  { icon: "🔗", title: "Your own landing page", body: "A branded /v/your-venue page guests can open from a QR or link." },
  { icon: "🎨", title: "Your brand color", body: "Woven into the song-creation flow so it feels like your venue." },
  { icon: "📣", title: "Attribution on every share", body: "Your venue name rides along on each shared song page." },
  { icon: "📱", title: "Nothing to install", body: "Just print a QR or drop the link — no hardware, no POS integration." },
  { icon: "🛠️", title: "Simple dashboard", body: "Manage your page with a magic link — update details anytime." },
  { icon: "✅", title: "Cancel anytime", body: "Month-to-month from the Stripe customer portal. No lock-in." },
];

const FAQS = [
  { q: "Do guests need an app or an account?", a: "No. They open your link, type a name, and get a free birthday-song preview in seconds — no download, no signup." },
  { q: "Do I need any hardware or setup?", a: "None. Print the QR for tables and receipts, or drop the link in your bio. That’s it." },
  { q: "What does the branding actually look like?", a: "Your venue name and brand color appear in the song-creation flow, and your name is attributed on every song page guests share." },
  { q: "Can I cancel whenever I want?", a: "Yes — it’s month-to-month. Manage or cancel anytime from the Stripe customer portal." },
  { q: "What’s included for $299/month?", a: "Your branded /v/ landing page, brand color in the flow, attribution on every share, a QR/link kit, and a magic-link dashboard to manage it." },
];

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

  const primaryCta = (label: string) => (
    <button
      type="button"
      onClick={startCheckout}
      disabled={loading}
      className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-jade px-8 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 hover:bg-jade-deep active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-soft disabled:shadow-none disabled:hover:translate-y-0"
    >
      {loading ? "Redirecting…" : label}
    </button>
  );

  return (
    <main className="grain relative min-h-screen overflow-x-hidden bg-cream text-ink">
      {/* Warm organic blobs — same language as the rest of the app. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-52 top-40 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />

      {/* Minimal top bar — brand anchor only (the global theme switch floats
          top-right). Local landing pages keep navigation to a minimum. */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center px-5 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo-mark-tight.png" alt="" width={40} height={40} className="h-10 w-10 drop-shadow-sm" />
          <span className="font-display text-xl font-extrabold tracking-tight text-ink">Sing My Birthday</span>
        </Link>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-6 lg:grid-cols-2 lg:pt-10">
        <div className="animate-rise text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-sand bg-cream-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-jade shadow-sm">
            For venues · Founding partner
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            Turn birthdays into your{" "}
            <span className="text-warm-gradient">best marketing</span>.
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            Give guests a personalized birthday song branded to your venue — and put your name
            in front of everyone they share it with. No app, no hardware, no work.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
            {primaryCta("Become a founding venue")}
            <a
              href="#how"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-sand bg-cream px-6 text-sm font-bold text-ink transition hover:border-jade active:scale-[0.99]"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-soft lg:justify-start">
            <span>💳 Secure checkout by Stripe</span>
            <span aria-hidden className="opacity-40">·</span>
            <span>Cancel anytime</span>
            <span aria-hidden className="opacity-40">·</span>
            <span>Founding-cohort pricing</span>
          </p>
        </div>

        {/* Branded-flow mock — shows a venue exactly how they'll appear. */}
        <div className="animate-rise relative mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] border border-sand bg-cream-soft p-5 shadow-sm">
            <div className="flex items-center gap-2 rounded-r-xl border-l-2 border-jade bg-cream px-4 py-2 text-sm font-semibold text-ink">
              <span>Birthday songs at</span>
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-jade" />
              <span className="text-jade">Your Venue</span>
            </div>
            <div className="mt-4 rounded-2xl border border-sand bg-cream px-5 py-8 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Their song, your brand</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-warm-gradient">Happy Birthday, Maya!</p>
              <div className="mt-4 flex items-end justify-center gap-1.5" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-warm-gradient animate-eq"
                    style={{ height: 26, animationDelay: `${i * 0.1}s`, animationDuration: `${0.8 + (i % 3) * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-ink-soft">
              Shared to friends with <span className="font-bold text-ink">Your Venue</span> on it.
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-6 px-5 py-14">
        <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-jade">How it works</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center font-display text-3xl font-extrabold text-ink sm:text-4xl">
          Live in a day, working while you serve.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-sand bg-cream-soft p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-warm-gradient text-base font-extrabold text-white shadow-sm">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFITS ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-14">
        <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-jade">What you get</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center font-display text-3xl font-extrabold text-ink sm:text-4xl">
          A marketing channel guests actually enjoy.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-sand bg-cream-soft p-6">
              <span aria-hidden className="text-2xl">{b.icon}</span>
              <h3 className="mt-3 font-display text-base font-bold text-ink">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{b.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-soft">
          Perfect for{" "}
          <span className="font-semibold text-ink">restaurants, bars, cafés, hotels &amp; event spaces</span>.
        </p>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-md px-5 py-14">
        <div className="rounded-[2rem] border border-sand bg-cream-soft p-8 shadow-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-sand bg-cream px-3 py-1 text-xs font-semibold text-jade shadow-sm">
            Founding Venue · Limited
          </span>
          <p className="mt-5 font-display text-5xl font-extrabold text-ink">
            $299<span className="text-lg font-medium text-ink-soft">/mo</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">Everything below. Cancel anytime.</p>

          <ul className="mt-6 space-y-2.5 text-sm text-ink">
            {[
              "Your branded /v/your-venue landing page",
              "Your brand color in the song flow",
              "Attribution on every shared song",
              "QR + link kit for tables & receipts",
              "Magic-link dashboard to manage it",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-jade">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7">{primaryCta("Become a founding venue")}</div>

          <div className="mt-4 flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-sand" />
            <span>or</span>
            <span className="h-px flex-1 bg-sand" />
          </div>

          <a
            href={VENUE_MAILTO}
            className="mt-4 block w-full rounded-full border border-sand bg-cream py-3.5 text-center text-sm font-bold text-ink transition hover:border-jade active:scale-[0.99]"
          >
            Not ready? Talk to us about your venue →
          </a>

          {error && <p role="alert" className="mt-3 text-center text-sm text-blush">{error}</p>}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-5 py-14">
        <h2 className="text-center font-display text-3xl font-extrabold text-ink sm:text-4xl">Questions, answered</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-sand bg-cream-soft px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-base font-bold text-ink">
                {f.q}
                <span aria-hidden className="text-ink-soft transition group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-20 pt-6">
        <div className="overflow-hidden rounded-[2rem] border border-jade/30 bg-warm-soft p-10 text-center">
          <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Be one of the founding venues.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Give your guests something to remember — and let every birthday send new people your way.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {primaryCta("Become a founding venue")}
            <a
              href="mailto:founders@singmybirthday.com?subject=Venue%20question%20%E2%80%94%20Sing%20My%20Birthday"
              className="text-sm font-semibold text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade"
            >
              founders@singmybirthday.com
            </a>
          </div>
          <p className="mt-5 text-center text-xs text-ink-soft">
            By continuing, you agree to the{" "}
            <Link href="/terms" className="font-semibold text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade">
              Terms of Service
            </Link>{" "}
            and acknowledge the{" "}
            <Link href="/privacy" className="font-semibold text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
