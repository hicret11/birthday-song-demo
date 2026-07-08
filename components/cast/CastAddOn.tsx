"use client";

// Cast add-on entry point — book an original character to phone the birthday
// person (AI voice call). Rendered as an independent upsell on the share page;
// it does not touch the song, the paywall, or unlock state.
//
// Flow: pick a character → recipient name/phone/note + REQUIRED consent +
// optional schedule → POST /api/cast/book (creates a pending booking) → POST
// /api/cast/checkout (opens one-time Stripe Checkout) → redirect to Stripe.
//
// LEGAL, surfaced in the UI: only our original characters, and every call opens
// with an AI disclosure. Consent is mandatory — the checkbox gates submission
// both here and server-side.

import { useMemo, useState } from "react";
import { ACTIVE_CAST_CHARACTERS } from "@/lib/cast/characters";
import type { Dict } from "@/lib/i18n";

type CastDict = Dict["cast"];

// Mirror of the server's E.164 check so we fail fast before the round-trip.
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export default function CastAddOn({
  giftId,
  recipientName,
  language,
  t,
  dir,
}: {
  giftId: string;
  recipientName: string;
  language: string;
  t: CastDict;
  dir: "ltr" | "rtl";
}) {
  const [open, setOpen] = useState(false);
  const [characterId, setCharacterId] = useState<string>(ACTIVE_CAST_CHARACTERS[0]?.id ?? "");
  const [name, setName] = useState(recipientName ?? "");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [schedule, setSchedule] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const character = useMemo(
    () => ACTIVE_CAST_CHARACTERS.find((c) => c.id === characterId),
    [characterId],
  );
  // Per-character tagline is localized in the dict, with a fallback to the
  // data-file copy for any character not yet translated.
  const taglineFor = (id: string): string => {
    const map = t.characters as Record<string, { tagline: string } | undefined>;
    return map[id]?.tagline ?? ACTIVE_CAST_CHARACTERS.find((c) => c.id === id)?.tagline ?? "";
  };

  const displayName = name.trim() || recipientName || "";

  async function submit() {
    setError(null);
    if (!character) {
      setError(t.errPickCharacter);
      return;
    }
    if (!name.trim()) {
      setError(t.errName);
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError(t.errPhone);
      return;
    }
    if (!consent) {
      setError(t.errConsent);
      return;
    }

    let scheduledAt: string | undefined;
    if (schedule) {
      const ts = Date.parse(schedule);
      if (!Number.isNaN(ts)) scheduledAt = new Date(ts).toISOString();
    }

    setSubmitting(true);
    try {
      // 1. Create the pending booking.
      const bookRes = await fetch("/api/cast/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          recipientName: name.trim(),
          recipientPhone: phone.trim(),
          language,
          personalNote: note.trim() || undefined,
          scheduledAt,
          consent: true,
          giftId,
        }),
      });
      const bookData = (await bookRes.json().catch(() => ({}))) as {
        ok?: boolean;
        booking?: { id?: string };
        error?: { message?: string };
      };
      if (!bookRes.ok || !bookData.ok || !bookData.booking?.id) {
        setError(bookData.error?.message ?? t.errGeneric);
        setSubmitting(false);
        return;
      }

      // 2. Open Stripe Checkout for the booking and redirect.
      const coRes = await fetch("/api/cast/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: bookData.booking.id }),
      });
      const coData = (await coRes.json().catch(() => ({}))) as {
        url?: string;
        error?: { message?: string };
      };
      if (!coRes.ok || !coData.url) {
        setError(coData.error?.message ?? t.errGeneric);
        setSubmitting(false);
        return;
      }
      window.location.assign(coData.url);
    } catch {
      setError(t.errNetwork);
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <section dir={dir} className="mx-auto mt-8 w-full max-w-[540px] px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border border-sand bg-cream-soft p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-pink"
        >
          <span className="block font-display text-lg font-black text-ink">{t.ctaTitle}</span>
          <span className="mt-1 block text-sm text-ink-soft">
            {fill(t.ctaSubtitle, { name: displayName })}
          </span>
          <span className="mt-3 inline-block rounded-full bg-gradient-to-r from-brand-amber to-brand-pink px-5 py-2 text-sm font-extrabold text-white">
            {t.open}
          </span>
        </button>
      </section>
    );
  }

  return (
    <section dir={dir} className="mx-auto mt-8 w-full max-w-[540px] px-4">
      <div className="rounded-3xl border border-sand bg-cream-soft p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-black text-ink">{t.ctaTitle}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="shrink-0 text-xs font-semibold text-ink-soft underline"
          >
            {t.close}
          </button>
        </div>

        {/* Character picker */}
        <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
          {t.pickCharacter}
        </p>
        <div className="mt-2 grid gap-2">
          {ACTIVE_CAST_CHARACTERS.map((c) => {
            const sel = c.id === characterId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCharacterId(c.id)}
                aria-pressed={sel}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                  sel
                    ? "border-brand-pink bg-cream ring-2 ring-brand-pink/40"
                    : "border-sand bg-cream hover:border-brand-pink"
                }`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{c.name}</span>
                  <span className="block text-xs text-ink-soft">{taglineFor(c.id)}</span>
                </span>
                <span className="shrink-0 text-sm font-extrabold text-ink">${c.priceUsd}</span>
              </button>
            );
          })}
        </div>

        {/* Recipient + details */}
        <label className="mt-4 block text-xs font-bold text-ink">{t.recipientNameLabel}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder={t.recipientNamePlaceholder}
          className="mt-1 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-base text-ink outline-none focus:border-brand-pink"
        />

        <label className="mt-3 block text-xs font-bold text-ink">{t.phoneLabel}</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.slice(0, 20))}
          inputMode="tel"
          placeholder={t.phonePlaceholder}
          className="mt-1 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-base text-ink outline-none focus:border-brand-pink"
        />
        <p className="mt-1 text-[11px] text-ink-soft">{t.phoneHint}</p>

        <label className="mt-3 block text-xs font-bold text-ink">{t.noteLabel}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 400))}
          rows={2}
          placeholder={t.notePlaceholder}
          className="mt-1 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-sm text-ink outline-none focus:border-brand-pink"
        />

        <label className="mt-3 block text-xs font-bold text-ink">{t.scheduleLabel}</label>
        <input
          type="datetime-local"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-sm text-ink outline-none focus:border-brand-pink"
        />
        <p className="mt-1 text-[11px] text-ink-soft">{t.scheduleHint}</p>

        {/* AI disclosure — legal, always visible */}
        <div className="mt-4 rounded-2xl border border-sand bg-cream px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
            {t.disclosureTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.disclosure}</p>
        </div>

        {/* Mandatory consent */}
        <label className="mt-4 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-pink"
          />
          <span className="text-xs leading-relaxed text-ink">
            {fill(t.consentLabel, { name: displayName })}
          </span>
        </label>

        {error && <p className="mt-3 text-sm font-semibold text-brand-pink">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !consent}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-amber to-brand-pink px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {submitting
            ? t.submitting
            : character
              ? `${t.submit}  ·  $${character.priceUsd}`
              : t.submit}
        </button>
      </div>
    </section>
  );
}
