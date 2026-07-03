import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, Music, Send } from "lucide-react";
import JsonLd from "@/components/JsonLd";

const SITE_URL = "https://singmybirthday.com";

export const runtime = "nodejs";
// Allow names that aren't in the sitemap seed list to still render on demand.
export const dynamicParams = true;

// A small handful of popular names used for internal linking between landing
// pages. Keeping these in sync with the sitemap seed list is not required —
// these are just cross-links to help discovery.
const RELATED_NAMES = [
  "Emma",
  "Olivia",
  "Liam",
  "Noah",
  "Sophia",
  "Mateo",
  "Aria",
  "Leo",
];

/**
 * Turn a raw URL segment into a clean, display-ready first name.
 * - decode percent-encoding
 * - strip anything that isn't a letter, space or hyphen
 * - collapse whitespace, cap the length
 * - Title Case each word
 * Returns null when nothing usable remains.
 */
function cleanName(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const stripped = decoded
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  if (!stripped) return null;
  const titled = stripped
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part ? part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase() : part,
        )
        .join("-"),
    )
    .join(" ");
  return titled;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const display = cleanName(name);
  if (!display) {
    return {
      title: "Happy Birthday Song — Free Personalized AI Birthday Song",
      description:
        "Make a free, personalized birthday song in about a minute. Any name, any language, any style.",
    };
  }
  const canonical = `/happy-birthday/${encodeURIComponent(name)}`;
  const title = `Happy Birthday ${display} Song — Free Personalized AI Birthday Song`;
  const description = `A birthday song made just for ${display}. Create a free, personalized ${display} birthday song in any language and style — ready to share in about a minute. No signup.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Sing My Birthday",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const STEPS: Array<{ icon: typeof Sparkles; title: string; body: string }> = [
  {
    icon: Sparkles,
    title: "Tell us about them",
    body: "Add the name, a couple of details, and pick a vibe.",
  },
  {
    icon: Music,
    title: "We make the song",
    body: "Our AI writes and sings a one-of-a-kind track in about a minute.",
  },
  {
    icon: Send,
    title: "Send the joy",
    body: "Share the link anywhere — WhatsApp, text, or social.",
  },
];

export default async function HappyBirthdayNamePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const display = cleanName(name) ?? "you";
  const generateHref = `/generate?name=${encodeURIComponent(display)}`;
  const pageUrl = `${SITE_URL}/happy-birthday/${encodeURIComponent(name)}`;

  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Personalized birthday song for ${display}`,
    description: `A one-of-a-kind, personalized birthday song made for ${display} — written and sung in about a minute, in any language and style.`,
    serviceType: "Personalized birthday song",
    url: pageUrl,
    provider: {
      "@type": "Organization",
      name: "Sing My Birthday",
      url: SITE_URL,
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `Happy Birthday ${display}`,
        item: pageUrl,
      },
    ],
  };

  const faqs: Array<{ q: string; a: string }> = [
    {
      q: `Is the ${display} birthday song really free?`,
      a: "Yes. You can create and preview a personalized song for free, with no signup required.",
    },
    {
      q: "How long does it take?",
      a: "About a minute. You tell us a few details and the song is written and sung automatically.",
    },
    {
      q: "Can I make it in another language?",
      a: `Absolutely — you can create ${display}'s song in dozens of languages and musical styles.`,
    },
  ];

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] text-white">
      <JsonLd data={service} />
      <JsonLd data={breadcrumbs} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,72,153,0.20),transparent_55%),radial-gradient(circle_at_88%_72%,rgba(245,158,11,0.14),transparent_55%),radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.12),transparent_60%)]"
      />

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-16 text-center sm:py-24">
        <Link href="/" aria-label="Sing My Birthday home">
          <Image
            src="/brand/logo-mark.png"
            alt="Sing My Birthday"
            width={120}
            height={120}
            priority
            className="mb-8 drop-shadow-[0_12px_32px_rgba(236,72,153,0.40)]"
          />
        </Link>

        <h1 className="text-balance bg-brand bg-clip-text pb-3 text-[clamp(34px,7vw,58px)] font-extrabold leading-[1.05] text-transparent">
          A birthday song made for {display}
        </h1>

        <p className="mt-4 max-w-md text-balance text-[clamp(15px,3vw,18px)] text-gray-300">
          Surprise {display} with a one-of-a-kind, personalized birthday song —
          written and sung in about a minute. Pick any language and any style,
          then share it anywhere. It&apos;s free and there&apos;s no signup.
        </p>

        <div className="mt-10 flex w-full justify-center">
          <Link
            href={generateHref}
            className="inline-flex items-center justify-center rounded-full bg-brand px-8 py-4 text-lg font-extrabold text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110"
          >
            Make {display}&apos;s song →
          </Link>
        </div>

        <p className="mt-3 text-xs text-gray-400">Free · no signup</p>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-12">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {STEPS.map(({ icon: Icon, title, body }, idx) => (
            <li
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-lg">
                <Icon size={18} strokeWidth={2.4} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Step {idx + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-sm text-gray-300">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Value / why */}
      <section className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-12 text-center">
        <p className="text-balance text-base text-gray-300">
          Generic birthday cards are forgettable. A song with {display}&apos;s
          name in the lyrics is the kind of gift people screenshot, replay, and
          keep. No instruments, no studio, no awkward singing required.
        </p>
        <div className="mt-6">
          <Link
            href={generateHref}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
          >
            Start {display}&apos;s birthday song
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-12">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          Questions
        </h2>
        <dl className="mt-6 space-y-4">
          {faqs.map(({ q, a }) => (
            <div
              key={q}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <dt className="text-sm font-semibold text-white">{q}</dt>
              <dd className="mt-1 text-sm text-gray-300">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Internal links */}
      <section className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-16 text-center">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          More birthday songs
        </h2>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {RELATED_NAMES.filter((n) => n.toLowerCase() !== display.toLowerCase()).map(
            (n) => (
              <Link
                key={n}
                href={`/happy-birthday/${n.toLowerCase()}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 backdrop-blur transition hover:text-white"
              >
                Happy Birthday {n}
              </Link>
            ),
          )}
        </div>
        <p className="mt-6 text-xs text-gray-400">
          <Link href="/" className="font-semibold text-fuchsia-200 underline underline-offset-2 hover:text-white">
            ← Back to Sing My Birthday
          </Link>
        </p>
      </section>
    </main>
  );
}
