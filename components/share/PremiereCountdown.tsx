"use client";

// The locked premiere ticket + live countdown (giver-sends delivery).
//
// Shown on /share/[id] when the song's delivery is "scheduled" and the reveal
// instant hasn't passed — so a recipient who opens the link early sees a
// theatrical "premieres on their birthday" ticket instead of the song. This is
// an ADDITIONAL gate on top of the paywall: it renders NO media at all (the
// server returns the countdown before ShareTemplateView), so nothing to leak.
//
// The giver bypasses it with ?preview=<token>; everyone else counts down. When
// the countdown hits zero we reload so the full premiere renders.

import { useEffect, useState } from "react";
import { getDictionary, isRtl, type Locale } from "@/lib/i18n";

function fmtDate(deliverAt: string, timezone: string | undefined, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(deliverAt));
  } catch {
    return new Date(deliverAt).toLocaleDateString(locale);
  }
}

export default function PremiereCountdown({
  recipientName,
  deliverAt,
  timezone,
  locale = "en",
}: {
  recipientName: string;
  deliverAt: string;
  timezone?: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).countdown;
  const dir = isRtl(locale) ? "rtl" : "ltr";
  // null until mounted → avoids SSR/client hydration mismatch on the live clock.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = Date.parse(deliverAt);
    if (Number.isNaN(target)) return;
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        // The premiere has opened — reload so the server renders the reveal.
        window.location.reload();
        return;
      }
      setRemaining(ms);
    };
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [deliverAt]);

  const ms = remaining ?? 0;
  const days = Math.floor(ms / 86_400_000);
  const hrs = Math.floor(ms / 3_600_000) % 24;
  const mins = Math.floor(ms / 60_000) % 60;
  const secs = Math.floor(ms / 1000) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateLabel = fmtDate(deliverAt, timezone, locale);

  const units: Array<{ v: string; label: string }> = [
    { v: pad(days), label: t.days },
    { v: pad(hrs), label: t.hrs },
    { v: pad(mins), label: t.mins },
    { v: pad(secs), label: t.secs },
  ];

  return (
    <main
      dir={dir}
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(1100px 640px at 50% -10%, #3a1f5e 0%, #1c1030 46%, #120a1e 100%)",
        color: "#f4e9ff",
      }}
    >
      <div className="w-full max-w-md">
        <div
          className="relative rounded-2xl p-6 text-center shadow-2xl sm:p-8"
          style={{
            background: "linear-gradient(135deg,#2a1745,#160b26)",
            border: "1px solid rgba(255,207,107,.4)",
          }}
        >
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.3em]"
            style={{ color: "#ffcf6b" }}
          >
            {t.admission}
          </p>

          <h1
            className="mx-auto mt-3 max-w-[16ch] text-2xl font-black uppercase leading-tight sm:text-3xl"
            style={{
              backgroundImage: "linear-gradient(120deg,#fff,#ffd98a 45%,#ff6fae)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {t.title.replace("{name}", recipientName || t.theStar)}
          </h1>

          <div
            className="my-5"
            style={{ borderTop: "1.5px dashed rgba(255,207,107,.35)" }}
          />

          <p className="text-sm" style={{ color: "#c9b8e6" }}>
            {t.premieresOn.replace("{date}", dateLabel)}
          </p>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#ffcf6b" }}>
            {t.opensIn}
          </p>
          <div className="mt-2 flex justify-center gap-3 sm:gap-4" aria-live="off">
            {units.map((u, i) => (
              <div key={i} className="flex min-w-[52px] flex-col items-center">
                <span
                  className="tabular-nums text-3xl font-black sm:text-4xl"
                  style={{ color: "#f4e9ff" }}
                >
                  {remaining === null ? "—" : u.v}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-widest" style={{ color: "#a596c4" }}>
                  {u.label}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs" style={{ color: "#a596c4" }}>
            {t.footer}
          </p>
        </div>
      </div>
    </main>
  );
}
