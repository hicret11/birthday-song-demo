"use client";

import { LOCALES, type Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
  tr: "TR",
  ar: "العربية",
};

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  function setLocale(next: Locale) {
    if (next === locale) return;
    // 1 year, site-wide. Read server-side by resolveLocale().
    // eslint-disable-next-line react-hooks/immutability -- runs in a click handler, not render; writing document.cookie is a legitimate browser side effect
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5 backdrop-blur"
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
              active
                ? "bg-white/15 text-white"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
