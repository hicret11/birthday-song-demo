import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Music, Send, ShieldCheck, Clock, Heart, Repeat } from "lucide-react";
import LandingCta from "@/components/LandingCta";
import JsonLd from "@/components/JsonLd";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: { absolute: "Sing My Birthday — A custom birthday song, written & sung just for them" },
  description:
    "Type their name, pick a vibe — we compose an original birthday song with their name in the lyrics. Ready in about a minute. Free preview, no signup to start.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const SITE_URL = "https://singmybirthday.com";

// English-first redesign pass. Copy hardcoded while we lock the direction;
// i18n dictionaries get re-threaded after sign-off. NO fabricated social proof
// (no fake review quotes / customer counts) — those go in only when real.

const STEPS = [
  {
    n: "01",
    icon: Sparkles,
    title: "Tell us about them",
    body: "Their name, the occasion, an inside joke or two. The more you share, the more personal it gets.",
  },
  {
    n: "02",
    icon: Music,
    title: "We compose it",
    body: "An original song — their name woven into real lyrics, sung in the style you picked. About a minute.",
  },
  {
    n: "03",
    icon: Send,
    title: "Send the moment",
    body: "A beautiful reveal page or a download. Watch their face the second they press play.",
  },
];

const STYLES = [
  { name: "Soft Acoustic", tint: "from-[#ffd9c2] to-[#ff9f7e]" },
  { name: "Pop", tint: "from-[#ffe0b0] to-[#ffb15c]" },
  { name: "Hip-Hop", tint: "from-[#ffc6dd] to-[#ff5f86]" },
  { name: "R&B", tint: "from-[#e9c8ff] to-[#b06bff]" },
  { name: "Rock", tint: "from-[#ffb9b0] to-[#ff6f6f]" },
  { name: "Classic Crooner", tint: "from-[#ffe7c2] to-[#e0b055]" },
];

const WHY = [
  {
    icon: Heart,
    title: "Personal, not generic",
    body: "Their name and your inside jokes, written into real lyrics — not a template with a name pasted on top.",
  },
  {
    icon: Clock,
    title: "Ready in a minute",
    body: "No waiting days for a birthday that's tomorrow. Hear a free preview, then it's delivered instantly.",
  },
  {
    icon: Repeat,
    title: "Theirs to keep",
    body: "Flowers wilt and gift cards get forgotten. A song about them is the one they replay every year.",
  },
];

const FAQ = [
  {
    q: "Is it really personalized, or just my name dropped in?",
    a: "Real lyrics. We write an original song around the details you give us — the occasion, your relationship, the little inside jokes — then sing it in the style you choose. The name isn't pasted on; it's part of the story.",
  },
  {
    q: "How fast is it?",
    a: "About a minute. You'll hear a free preview before you decide anything, and the full song is delivered instantly — no waiting days for a birthday that's tomorrow.",
  },
  {
    q: "Do I need to create an account?",
    a: "No. Start creating right away. We only ask where to send the finished song at checkout, and saving an account is optional.",
  },
  {
    q: "What if I don't love it?",
    a: "Then you don't pay. Love it or it's free — if the song isn't right, we'll remake it or refund you, no questions asked.",
  },
];

function Equalizer() {
  const bars = [0.5, 0.85, 0.35, 1, 0.6, 0.9, 0.45, 0.75, 0.55, 0.95, 0.4, 0.7];
  return (
    <div className="flex items-center gap-[5px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="animate-eq w-[6px] rounded-full bg-gradient-to-b from-white to-blush"
          style={{ height: `${18 + h * 42}px`, animationDelay: `${(i % 6) * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sing My Birthday",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/logo-mark.png`,
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Sing My Birthday",
    url: SITE_URL,
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="grain relative flex min-h-screen flex-col overflow-hidden bg-cream text-ink">
      <JsonLd data={organization} />
      <JsonLd data={website} />
      <JsonLd data={faqPage} />

      {/* Organic warm blobs, bleeding off the edges (anti-template). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.28),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.26),transparent_66%)] blur-2xl"
      />

      {/* Header */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo-mark-tight.png" alt="" width={44} height={44} className="h-11 w-11 drop-shadow-sm" />
          <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Sing My Birthday
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/my-songs"
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:text-ink"
          >
            My songs
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-5 pb-20 pt-6 lg:grid-cols-2 lg:gap-10 lg:pt-12">
        <div className="animate-rise text-center lg:text-left">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-jade">
            Personalized birthday songs
          </p>

          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            A birthday song,
            <br />
            written &amp; sung
            <br />
            <span className="font-serif italic font-normal text-warm-gradient">just for them</span>
            <span className="text-blush">.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft lg:mx-0 lg:text-xl">
            Type their name, pick a vibe — we compose an original song with their
            name woven into the lyrics. Ready in about a minute. No music skills,
            no waiting.
          </p>

          <div className="mt-9 flex justify-center lg:justify-start">
            <LandingCta label="Create their song →" />
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-ink-soft lg:justify-start">
            <li className="inline-flex items-center gap-1.5">
              <Sparkles size={15} className="text-jade" /> Free 15-second preview
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-jade" /> No signup to start
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Clock size={15} className="text-jade" /> Delivered instantly
            </li>
          </ul>
        </div>

        {/* Hero artifact — the product as a beautiful, slightly-tilted player card. */}
        <div className="animate-rise [animation-delay:120ms]">
          <div className="relative mx-auto max-w-sm rotate-1">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-warm-gradient opacity-20 blur-3xl" />
            <div className="grain relative overflow-hidden rounded-[1.9rem] border border-sand bg-cream-soft p-6 shadow-[0_30px_70px_-34px_rgba(60,40,30,0.45)]">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-warm-gradient text-white shadow-lg">
                  <Music size={26} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-ink">Happy Birthday, Sofia</p>
                  <p className="text-sm text-ink-soft">Soft Acoustic · English</p>
                </div>
              </div>

              <div className="mt-6 flex items-end justify-center rounded-2xl bg-noir px-5 py-7">
                <Equalizer />
              </div>

              <div className="mt-5 flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-jade text-white shadow-lg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <div className="h-1.5 flex-1 rounded-full bg-sand">
                  <div className="h-full w-1/3 rounded-full bg-warm-gradient" />
                </div>
                <span className="text-xs font-semibold text-ink-soft">0:15</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STYLES (calm raised band, pill row — honest: these are the styles offered) */}
      <section className="relative z-10 border-y border-sand bg-cream-soft">
        <div className="mx-auto w-full max-w-5xl px-5 py-14">
          <p className="text-center font-serif text-2xl italic text-ink-soft">
            Any voice, any style
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {STYLES.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-2.5 rounded-full border border-sand bg-cream py-2 pl-2 pr-5"
              >
                <span className={`h-7 w-7 rounded-full bg-gradient-to-br ${s.tint}`} />
                <span className="font-display text-sm font-bold text-ink">{s.name}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (editorial numbered flow — no boxes) ─────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-20">
        <h2 className="text-center font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          A real song, in <span className="font-serif italic font-normal text-jade">three taps</span>
        </h2>

        <div className="relative mt-14 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
          <div aria-hidden className="absolute left-0 right-0 top-8 hidden border-t border-dashed border-sand sm:block" />
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.n} className="relative text-center sm:text-left">
                <div className="flex items-center justify-center gap-3 sm:justify-start">
                  <span className="font-display text-6xl font-extrabold leading-none text-tan">
                    {step.n}
                  </span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warm-gradient text-white shadow-md">
                    <Icon size={19} strokeWidth={2.2} />
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WHY A SONG (honest desire-building — replaces fake testimonials) ── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16">
        <h2 className="mx-auto max-w-2xl text-center font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          Not another{" "}
          <span className="font-serif italic font-normal text-blush">gift card</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed text-ink-soft">
          A song is the rare gift that&apos;s personal, instant, and impossible to
          re-gift. Here&apos;s why it lands.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {WHY.map((w) => {
            const Icon = w.icon;
            return (
              <div key={w.title} className="text-center sm:text-left">
                <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-warm-gradient text-white shadow-md">
                  <Icon size={22} strokeWidth={2} />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">{w.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{w.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── GUARANTEE ────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-5 py-12">
        <div className="grain relative overflow-hidden rounded-[2rem] bg-forest px-8 py-12 text-center text-white shadow-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,160,120,0.35),transparent_65%)]"
          />
          <p className="font-serif text-xl italic text-peach">Our promise</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Love it, or it&apos;s free.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85">
            Hear a free preview before you pay a cent. If the finished song isn&apos;t
            perfect, we&apos;ll remake it or refund you — no questions asked.
          </p>
          <div className="mt-8">
            <LandingCta label="Create their song →" />
          </div>
        </div>
      </section>

      {/* ── FAQ (editorial divider list — no boxes) ──────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-5 py-16">
        <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Good to <span className="font-serif italic font-normal text-jade">know</span>
        </h2>
        <dl className="mt-8 divide-y divide-tan">
          {FAQ.map((item) => (
            <div key={item.q} className="py-6">
              <dt className="font-display text-lg font-bold text-ink">{item.q}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 text-center">
          <p className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
            Their best birthday surprise is a{" "}
            <span className="font-serif italic font-normal text-blush">minute</span> away.
          </p>
          <div className="mt-7 flex justify-center">
            <LandingCta label="Create their song →" />
          </div>
        </div>
      </section>
    </main>
  );
}
