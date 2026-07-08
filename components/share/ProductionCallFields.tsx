"use client";

// Production-tier call setup — shown when the buyer picks "Full Production".
//
// Collects what the AI character birthday call needs: which character phones
// them, the recipient's phone (E.164), an optional date, and the giver's
// consent attestation (we use a giver-attests model; see the compliance docs).
// Purely presentational + controlled — the parent owns the state and sends it
// to /api/stripe/checkout-song, which validates again server-side.

import { getDictionary, type Locale } from "@/lib/i18n";
import { CAST_CHARACTER_CHOICES } from "@/lib/cast/characters";
import { isCallAllowedForPhone } from "@/lib/cast/call-countries";

/** Loose E.164 mirror of the server check — leading +, 7–15 digits, first non-zero. */
export const CALL_PHONE_RE = /^\+[1-9]\d{6,14}$/;

export type ProductionCallValue = {
  characterId: string;
  phone: string;
  /** "YYYY-MM-DD" from <input type="date">, or "" for as-soon-as-ready. */
  date: string;
  consent: boolean;
};

/** Whether the current values are complete enough to allow Production checkout. */
export function isProductionCallReady(v: ProductionCallValue): boolean {
  return (
    CAST_CHARACTER_CHOICES.some((c) => c.id === v.characterId) &&
    CALL_PHONE_RE.test(v.phone.trim()) &&
    // The call is only offered to recipients in the allowlisted countries.
    isCallAllowedForPhone(v.phone.trim()) &&
    v.consent
  );
}

/**
 * The EXACT attestation wording the giver agreed to, in their locale — persisted
 * as consent evidence (burden-of-proof trail for the giver-attests model).
 */
export function consentAttestationText(recipientName: string, locale: Locale = "en"): string {
  const who = recipientName.trim() || "them";
  return getDictionary(locale).paywall.callConsentLabel.replace("{name}", who);
}

export default function ProductionCallFields({
  recipientName,
  locale = "en",
  value,
  onChange,
}: {
  recipientName: string;
  locale?: Locale;
  value: ProductionCallValue;
  onChange: (next: ProductionCallValue) => void;
}) {
  const t = getDictionary(locale).paywall;
  const who = recipientName.trim() || "them";
  const fill = (s: string) => s.replace("{name}", who);
  // Show a notice when the entered number looks valid but its country isn't in
  // the call allowlist (the rest of the product stays available — only the call).
  const trimmedPhone = value.phone.trim();
  const countryBlocked =
    CALL_PHONE_RE.test(trimmedPhone) && !isCallAllowedForPhone(trimmedPhone);

  return (
    <div className="mt-3 rounded-2xl border border-blush/40 bg-cream p-4 text-left">
      <p className="font-display text-sm font-extrabold text-ink">{t.callHeading}</p>
      <p className="mt-1 text-xs text-ink-soft">{fill(t.callSubtext)}</p>

      {/* Character picker */}
      <label className="mt-3 block text-xs font-bold text-ink">{t.callCharacterLabel}</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {CAST_CHARACTER_CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange({ ...value, characterId: c.id })}
            aria-pressed={value.characterId === c.id}
            title={c.tagline}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              value.characterId === c.id
                ? "border-blush bg-warm-soft text-ink ring-1 ring-blush"
                : "border-sand bg-cream-soft text-ink hover:border-blush"
            }`}
          >
            <span aria-hidden>{c.emoji}</span> {c.name}
          </button>
        ))}
      </div>

      {/* Recipient phone */}
      <label htmlFor="prod-call-phone" className="mt-3 block text-xs font-bold text-ink">
        {fill(t.callPhoneLabel)}
      </label>
      <input
        id="prod-call-phone"
        type="tel"
        inputMode="tel"
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: e.target.value.slice(0, 20) })}
        placeholder={t.callPhonePlaceholder}
        className="mt-1 w-full rounded-xl border border-sand bg-cream-soft px-3 py-2.5 text-sm text-ink outline-none transition focus:border-blush focus:ring-1 focus:ring-blush"
      />
      <p className="mt-1 text-[11px] text-ink-soft">{t.callPhoneHint}</p>
      {countryBlocked && (
        <p className="mt-1 text-[11px] font-semibold text-brand-pink">{t.callCountryUnavailable}</p>
      )}

      {/* Optional date */}
      <label htmlFor="prod-call-date" className="mt-3 block text-xs font-bold text-ink">
        {t.callDateLabel}
      </label>
      <input
        id="prod-call-date"
        type="date"
        value={value.date}
        onChange={(e) => onChange({ ...value, date: e.target.value })}
        className="mt-1 w-full rounded-xl border border-sand bg-cream-soft px-3 py-2.5 text-sm text-ink outline-none transition focus:border-blush focus:ring-1 focus:ring-blush"
      />
      <p className="mt-1 text-[11px] text-ink-soft">{t.callDateHint}</p>

      {/* Consent attestation — required (giver-attests model) */}
      <label className="mt-3 flex items-start gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={value.consent}
          onChange={(e) => onChange({ ...value, consent: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-blush"
        />
        <span>{fill(t.callConsentLabel)}</span>
      </label>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{t.callConsentMicrocopy}</p>
    </div>
  );
}
