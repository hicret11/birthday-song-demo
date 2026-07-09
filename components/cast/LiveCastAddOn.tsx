"use client";

// Live (in-person) cast entry — request a REAL performer (musician or costumed
// character) for a birthday. A concierge pilot, gated server-side to the
// configured pilot cities: this component is only rendered when `cities` is
// non-empty, and it's framed clearly as a real human, NOT AI. Independent of the
// song, the paywall, and unlock state.
//
// Flow: pick musician/character → recipient + city + date + contact + REQUIRED
// consent → POST /api/cast/book → POST /api/cast/checkout (deposit) → Stripe.

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type CastLiveDict = Dict["castLive"];

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LiveCastAddOn({
  giftId,
  recipientName,
  cities,
  depositUsd,
  t,
  dir,
}: {
  giftId: string;
  recipientName: string;
  cities: string[];
  depositUsd: number;
  t: CastLiveDict;
  dir: "ltr" | "rtl";
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"live_musician" | "character_visit">("live_musician");
  const [name, setName] = useState(recipientName ?? "");
  const [city, setCity] = useState(cities[0] ?? "");
  const [eventDate, setEventDate] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name.trim() || recipientName || "";
  const badge = fill(t.pilotBadge, { city: cities.join(", ") });

  async function submit() {
    setError(null);
    if (!name.trim()) return setError(t.errName);
    if (!city || !cities.includes(city)) return setError(t.errCity);
    if (!eventDate || Number.isNaN(Date.parse(eventDate))) return setError(t.errDate);
    const phoneOk = (phone.match(/\d/g)?.length ?? 0) >= 7;
    const emailOk = EMAIL_RE.test(email.trim());
    if (!phoneOk && !emailOk) return setError(t.errContact);
    if (!consent) return setError(t.errConsent);

    setSubmitting(true);
    try {
      const bookRes = await fetch("/api/cast/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          recipientName: name.trim(),
          city,
          eventDate,
          addressNote: address.trim() || undefined,
          personalNote: note.trim() || undefined,
          contactPhone: phoneOk ? phone.trim() : undefined,
          contactEmail: emailOk ? email.trim() : undefined,
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
      <section dir={dir} className="mx-auto mt-4 w-full max-w-[540px] px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border border-sand bg-cream-soft p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-jade"
        >
          <span className="inline-block rounded-full bg-jade/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-jade">
            {badge}
          </span>
          <span className="mt-2 block font-display text-lg font-black text-ink">{t.ctaTitle}</span>
          <span className="mt-1 block text-sm text-ink-soft">
            {fill(t.ctaSubtitle, { name: displayName })}
          </span>
          <span className="mt-3 inline-block rounded-full bg-jade hover:bg-jade-deep px-5 py-2 text-sm font-extrabold text-white">
            {t.open}
          </span>
        </button>
      </section>
    );
  }

  const inputCls =
    "mt-1 w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-base text-ink outline-none focus:border-jade";
  const labelCls = "mt-3 block text-xs font-bold text-ink";

  return (
    <section dir={dir} className="mx-auto mt-4 w-full max-w-[540px] px-4">
      <div className="rounded-3xl border border-sand bg-cream-soft p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-jade/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-jade">
              {badge}
            </span>
            <h2 className="mt-2 font-display text-xl font-black text-ink">{t.ctaTitle}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="shrink-0 text-xs font-semibold text-ink-soft underline"
          >
            {t.close}
          </button>
        </div>

        {/* Human, not AI — legal/clarity framing */}
        <div className="mt-4 rounded-2xl border border-sand bg-cream px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
            {t.humanTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.human}</p>
        </div>

        {/* Kind */}
        <p className="mt-4 text-xs font-bold text-ink">{t.chooseKind}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            ["live_musician", t.kindMusician],
            ["character_visit", t.kindVisit],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                kind === k
                  ? "bg-jade hover:bg-jade-deep text-white"
                  : "border border-sand bg-cream text-ink hover:border-jade"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className={labelCls}>{t.recipientNameLabel}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder={t.recipientNamePlaceholder}
          className={inputCls}
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>{t.cityLabel}</label>
            {cities.length > 1 ? (
              <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input value={city} readOnly className={`${inputCls} opacity-80`} />
            )}
          </div>
          <div className="flex-1">
            <label className={labelCls}>{t.eventDateLabel}</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <label className={labelCls}>{t.addressLabel}</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value.slice(0, 200))}
          placeholder={t.addressPlaceholder}
          className={inputCls}
        />

        <label className={labelCls}>{t.noteLabel}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 400))}
          rows={2}
          placeholder={t.notePlaceholder}
          className={inputCls}
        />

        <p className="mt-4 text-xs font-bold text-ink">{t.contactHeading}</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>{t.contactPhoneLabel}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, 30))}
              inputMode="tel"
              placeholder={t.contactPhonePlaceholder}
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>{t.contactEmailLabel}</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 120))}
              inputMode="email"
              placeholder={t.contactEmailPlaceholder}
              className={inputCls}
            />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-jade"
          />
          <span className="text-xs leading-relaxed text-ink">{t.consentLabel}</span>
        </label>

        <p className="mt-3 text-[11px] text-ink-soft">{fill(t.depositNote, { deposit: `$${depositUsd}` })}</p>

        {error && <p className="mt-3 text-sm font-semibold text-jade">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !consent}
          className="mt-4 w-full rounded-2xl bg-jade hover:bg-jade-deep px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {submitting ? t.submitting : `${t.submit}  ·  $${depositUsd}`}
        </button>
      </div>
    </section>
  );
}
