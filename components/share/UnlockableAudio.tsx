"use client";

import { useRef, useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import {
  FULL_PRICE_LABEL,
  DELUXE_PRICE_LABEL,
  PRODUCTION_PRICE_LABEL,
  LIVE_ANCHOR_PRICE_LABEL,
} from "@/lib/pricing-display";
import ProductionCallFields, {
  isProductionCallReady,
  consentAttestationText,
  type ProductionCallValue,
} from "@/components/share/ProductionCallFields";

import { PREVIEW_SECONDS } from "@/lib/preview-config";
import { launchView, launchDiscountPercent } from "@/lib/launch-pricing";
import PriceLabel from "@/components/pricing/PriceLabel";

type Plan = "full" | "deluxe" | "production";

type Props = {
  shareId: string;
  audioSrc: string;
  unlocked: boolean;
  recipientName: string;
  /** Geo tier for price labels; falls back to "C" copy when absent. */
  tier?: "A" | "B" | "C";
  /** Display locale for paywall copy; defaults to English. */
  locale?: Locale;
  /**
   * Suppress this component's own <audio> element(s) while keeping everything
   * else (preview label, unlock CTA + checkout, Download MP3 link). Used by the
   * crowd Premiere, which is the audio source itself — so the paywall gate/CTA
   * stay identical, just without a second player. The gate is unchanged.
   */
  hidePlayer?: boolean;
};

/**
 * Audio player that gates playback behind the consumer paywall.
 *
 * - Unlocked: full playback + a "Download MP3" link.
 * - Locked: plays only the first PREVIEW_SECONDS. Playback is clamped via
 *   onTimeUpdate (pause + snap currentTime back to the limit) and onSeeking (any
 *   scrub past the limit is pulled back). A prominent unlock card POSTs to the
 *   Stripe checkout endpoint and redirects to the returned Checkout URL.
 */
export default function UnlockableAudio({
  shareId,
  audioSrc,
  unlocked,
  recipientName,
  tier,
  locale = "en",
  hidePlayer = false,
}: Props) {
  const tr = getDictionary(locale);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Default to the "Most chosen" middle tier so the selection ring, the badge,
  // and the checkout CTA all agree on the recommended pick (good-better-best).
  const [plan, setPlan] = useState<Plan>("deluxe");
  const [call, setCall] = useState<ProductionCallValue>({
    characterId: "",
    phone: "",
    date: "",
    consent: false,
  });

  const t = tier ?? "C";
  const fullLabel = FULL_PRICE_LABEL[t];
  const deluxeLabel = DELUXE_PRICE_LABEL[t];
  const productionLabel = PRODUCTION_PRICE_LABEL[t];
  // Launch discount: the CTA shows the price the buyer will actually pay, and
  // the plan rows strike through the original (see PriceLabel). Both no-op when
  // no launch is active.
  const launchPct = launchDiscountPercent();
  const fullCta = launchView(fullLabel).discounted;
  const deluxeCta = launchView(deluxeLabel).discounted;
  const productionCta = launchView(productionLabel).discounted;

  function handleTimeUpdate(): void {
    if (unlocked) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.currentTime >= PREVIEW_SECONDS) {
      el.pause();
      el.currentTime = PREVIEW_SECONDS;
      setPreviewEnded(true);
    }
  }

  function handleSeeking(): void {
    if (unlocked) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.currentTime > PREVIEW_SECONDS) {
      el.currentTime = PREVIEW_SECONDS;
    }
  }

  const productionReady = plan !== "production" || isProductionCallReady(call);

  async function startCheckout(): Promise<void> {
    if (requesting || !productionReady) return;
    setRequesting(true);
    setError(null);
    try {
      const callBody =
        plan === "production"
          ? {
              consent: call.consent,
              consentText: consentAttestationText(recipientName, locale),
              call: {
                characterId: call.characterId,
                phone: call.phone.trim(),
                scheduledAt: call.date
                  ? new Date(`${call.date}T10:00`).toISOString()
                  : undefined,
              },
            }
          : {};
      const res = await fetch("/api/stripe/checkout-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, plan, ...callBody }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || typeof data.url !== "string") {
        setError("Couldn't start checkout. Please try again.");
        setRequesting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setRequesting(false);
    }
  }

  if (unlocked) {
    return (
      <div className="mt-6">
        {!hidePlayer && (
          <audio
            ref={audioRef}
            controls
            src={audioSrc}
            className="w-full"
          />
        )}
        <a
          href={audioSrc}
          download
          className="mt-3 block w-full rounded-2xl border border-sand bg-cream-soft px-5 py-3 text-center text-sm font-bold text-ink shadow-sm transition hover:bg-warm-soft"
        >
          <span aria-hidden>⬇</span> Download MP3
        </a>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-jade-deep">
        {tr.paywall.previewLabelPrefix}{tr.paywall.previewLabelSuffix}
      </p>
      {!hidePlayer && (
        <audio
          ref={audioRef}
          controls
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          className="w-full"
        />
      )}

      <div className="mt-5 rounded-2xl border border-sand bg-cream-soft p-5 text-center shadow-sm">
        <p className="font-display text-lg font-extrabold tracking-tight text-ink">
          {previewEnded
            ? `${tr.paywall.unlockHeadlineLovedPrefix}${tr.paywall.unlockHeadlinePrefix}${recipientName}${tr.paywall.unlockHeadlineSuffix}`
            : `${tr.paywall.unlockHeadlinePrefix}${recipientName}${tr.paywall.unlockHeadlineSuffix}`}
        </p>

        {launchPct > 0 && (
          <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-extrabold text-ink">
            <span aria-hidden>🎉</span> Launch offer · {launchPct}% off today
          </p>
        )}

        {/* Good-better-best: pick Standard or Deluxe. */}
        <div className="mt-4 space-y-3 text-left">
          <button
            type="button"
            onClick={() => setPlan("full")}
            aria-pressed={plan === "full"}
            className={`block w-full rounded-2xl border p-4 text-left transition ${
              plan === "full"
                ? "border-jade bg-cream-soft ring-1 ring-jade"
                : "border-sand bg-cream hover:border-jade"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">{tr.paywall.standard}</span>
              <PriceLabel label={fullLabel} className="text-sm font-extrabold text-ink" />
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletCompleteSong}</span></li>
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletMp3}</span></li>
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletShareVideo}</span></li>
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletReplay}</span></li>
            </ul>
          </button>

          <button
            type="button"
            onClick={() => setPlan("deluxe")}
            aria-pressed={plan === "deluxe"}
            className={`relative block w-full overflow-hidden rounded-2xl border p-4 pt-5 text-left transition ${
              plan === "deluxe"
                ? "border-jade bg-cream-soft ring-2 ring-jade"
                : "border-jade/40 bg-cream hover:border-jade"
            }`}
          >
            {/* Recommendation ribbon — a full-width strip so the social-proof
                signal reads at a glance instead of an easy-to-miss inline pill. */}
            <span className="absolute inset-x-0 top-0 bg-jade py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-white">
              ★ {tr.paywall.mostChosen}
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">{tr.paywall.deluxe}</span>
              <PriceLabel label={deluxeLabel} className="text-sm font-extrabold text-ink" />
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              <li className="flex items-start gap-2"><span className="text-gold">★</span><span className="font-semibold">{tr.paywall.bulletSlideshow}</span></li>
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletCompleteSong}</span></li>
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletMp3}</span></li>
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletShareVideo}</span></li>
            </ul>
          </button>

          {/* Full Production is a NON-PURCHASABLE teaser until the AI-call
              feature clears legal + telephony is armed. Rendered as a muted,
              non-interactive "Coming soon" card — no selection, no checkout —
              so nobody can buy a birthday call that would never fire. */}
          <div
            aria-disabled="true"
            className="relative block w-full cursor-default rounded-2xl border border-dashed border-sand bg-cream/60 p-4 text-left opacity-80"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink-soft">
                {tr.paywall.production} <span aria-hidden>🎬</span>
                <span className="ml-1.5 rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                  {tr.paywall.comingSoon}
                </span>
              </span>
              <PriceLabel label={productionLabel} className="text-sm font-extrabold text-ink-soft" />
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
              <li className="flex items-start gap-2"><span>✓</span><span>{tr.paywall.bulletEverythingDeluxe}</span></li>
              <li className="flex items-start gap-2"><span>☎</span><span className="font-semibold">{tr.paywall.bulletCall}</span></li>
            </ul>
          </div>
        </div>

        {/* Live-musician anchor — makes the tiers read as the smart middle. */}
        <p className="mt-3 text-center text-[11px] text-ink-soft">
          {tr.paywall.liveAnchorLabel}{" "}
          <span className="font-bold text-ink">{LIVE_ANCHOR_PRICE_LABEL}</span>
        </p>

        {plan === "production" && (
          <ProductionCallFields
            recipientName={recipientName}
            locale={locale}
            value={call}
            onChange={setCall}
          />
        )}

        <button
          type="button"
          onClick={startCheckout}
          disabled={requesting || !productionReady}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-jade px-5 py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] hover:bg-jade-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {requesting ? (
            <>
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              {tr.paywall.openingCheckout}
            </>
          ) : plan === "production" ? (
            `${tr.paywall.unlockProductionPrefix} · ${productionCta} →`
          ) : plan === "deluxe" ? (
            `${tr.paywall.unlockDeluxePrefix} · ${deluxeCta} →`
          ) : (
            `${tr.paywall.unlockStandardPrefix} · ${fullCta} →`
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-jade-deep">
          <span aria-hidden>✓</span>{" "}
          <a href="/refund" target="_blank" rel="noopener noreferrer" className="underline decoration-jade/40 underline-offset-2 hover:decoration-jade">
            {tr.paywall.moneyBack}
          </a>
        </p>
        <p className="mt-1 text-[11px] text-ink-soft">
          {tr.paywall.secureCheckout}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-blush">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
