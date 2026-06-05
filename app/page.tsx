import type { Metadata } from "next";
import Image from "next/image";
import { Music, Send, Sparkles } from "lucide-react";
import LandingCta from "@/components/LandingCta";

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

const STEPS: Array<{ icon: typeof Sparkles; title: string }> = [
  { icon: Sparkles, title: "Tell us about them" },
  { icon: Music, title: "We make the song" },
  { icon: Send, title: "Send the joy" },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] text-white">
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
          Personalized birthday songs, made for the people you love.
        </h1>

        <p className="mt-4 max-w-md text-balance text-[clamp(15px,3vw,18px)] text-gray-300">
          For the people you love. In any language. In about a minute.
        </p>

        <div className="mt-10 flex w-full justify-center">
          <LandingCta />
        </div>

        <p className="mt-3 text-xs text-gray-400">Free · no signup</p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {STEPS.map(({ icon: Icon, title }, idx) => (
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
          ))}
        </ol>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-4 py-8 text-center">
        <Image
          src="/brand/logo-lockup.png"
          alt="Sing My Birthday"
          width={140}
          height={109}
          className="mx-auto opacity-80"
        />
        <p className="mt-2 text-xs text-gray-500">Made with love by Sing My Birthday</p>
      </footer>
    </main>
  );
}
