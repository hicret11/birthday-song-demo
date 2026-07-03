import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Music, Send, Sparkles } from "lucide-react";
import LandingCta from "@/components/LandingCta";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import JsonLd from "@/components/JsonLd";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  type Locale,
} from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { absolute: "Sing My Birthday — Personalized Birthday Songs in Any Language" },
  description:
    "Make a personalized birthday song for the people you love. Any language, any style, ready in about a minute. Free, no signup.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const NOTES: Array<{ char: string; top: string; left: string; size: string; delay: string }> = [
  { char: "♪", top: "12%", left: "8%", size: "28px", delay: "0s" },
  { char: "♫", top: "22%", left: "82%", size: "24px", delay: "3s" },
  { char: "♩", top: "62%", left: "10%", size: "20px", delay: "6s" },
  { char: "♬", top: "55%", left: "86%", size: "30px", delay: "9s" },
  { char: "♪", top: "78%", left: "44%", size: "22px", delay: "12s" },
];

const STEP_ICONS: Array<typeof Sparkles> = [Sparkles, Music, Send];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  // Locale priority: ?lang= query → cookie/Accept-Language (resolveLocale).
  const { lang } = await searchParams;
  const queryLang = Array.isArray(lang) ? lang[0] : lang;
  const locale: Locale = isLocale(queryLang)
    ? queryLang
    : await resolveLocale().catch(() => DEFAULT_LOCALE);
  const t = getDictionary(locale);

  const steps = [t.how.step1, t.how.step2, t.how.step3];

  const SITE_URL = "https://singmybirthday.com";
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
    mainEntity: t.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] text-white">
      <JsonLd data={organization} />
      <JsonLd data={website} />
      <JsonLd data={faqPage} />
      <nav className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <LanguageSwitcher locale={locale} />
        <Link
          href="/my-songs"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 backdrop-blur transition hover:text-white"
        >
          {t.nav.mySongs}
        </Link>
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,72,153,0.20),transparent_55%),radial-gradient(circle_at_88%_72%,rgba(245,158,11,0.14),transparent_55%),radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.12),transparent_60%)]"
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {NOTES.map((n, i) => (
          <span
            key={i}
            className="absolute animate-drift select-none text-fuchsia-200"
            style={{
              top: n.top,
              left: n.left,
              fontSize: n.size,
              animationDelay: n.delay,
            }}
          >
            {n.char}
          </span>
        ))}
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-16 text-center sm:py-24">
        <Image
          src="/brand/logo-mark.png"
          alt="Sing My Birthday"
          width={160}
          height={160}
          priority
          className="mb-8 drop-shadow-[0_12px_32px_rgba(236,72,153,0.40)]"
        />

        <h1 className="text-balance bg-brand bg-clip-text pb-3 text-[clamp(36px,8vw,64px)] font-extrabold leading-[1.05] text-transparent">
          {t.hero.title}
        </h1>

        <p className="mt-4 max-w-md text-balance text-[clamp(15px,3vw,18px)] text-gray-300">
          {t.hero.subtitle}
        </p>

        <div className="mt-10 flex w-full justify-center">
          <LandingCta label={t.hero.cta} />
        </div>

        <p className="mt-3 text-xs text-gray-400">{t.hero.freeNote}</p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          {t.how.title}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {steps.map((title, idx) => {
            const Icon = STEP_ICONS[idx];
            return (
              <li
                key={title}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-lg">
                  <Icon size={18} strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Step {idx + 1}
                  </p>
                  <p className="text-sm font-semibold text-white">{title}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-16">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          {t.faq.title}
        </h2>
        <dl className="mt-6 space-y-4">
          {t.faq.items.map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <dt className="text-sm font-semibold text-white">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-gray-300">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-4 py-8 text-center">
        <Image
          src="/brand/logo-lockup.png"
          alt="Sing My Birthday"
          width={140}
          height={109}
          className="mx-auto opacity-80"
        />
        <p className="mt-2 text-xs text-gray-500">{t.footer.madeWith}</p>
        <p className="mt-3 text-xs text-gray-400">
          {t.footer.venuePrompt}{" "}
          <Link
            href="/become-a-venue"
            className="font-semibold text-fuchsia-200 underline underline-offset-2 hover:text-white"
          >
            {t.footer.venueLink}
          </Link>
        </p>
      </footer>
    </main>
  );
}
