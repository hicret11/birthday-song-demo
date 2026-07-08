"use client";

import { useRef, useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import {
  FULL_PRICE_LABEL,
  DELUXE_PRICE_LABEL,
  PRODUCTION_PRICE_LABEL,
  LIVE_ANCHOR_PRICE_LABEL,
} from "@/lib/pricing-display";

const PREVIEW_SECONDS = 15;

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
 * - Locked: plays only the first PREVIEW_SECONDS (20s). Playback is clamped via
 *   onTimeUpdate (pause + snap currentTime back to 20) and onSeeking (any scrub
 *   past 20s is pulled back). A prominent unlock card POSTs to the Stripe
 *   checkout endpoint and redirects to the returned Checkout URL.
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
  const [plan, setPlan] = useState<Plan>("full");

  const t = tier ?? "C";
  const fullLabel = FULL_PRICE_LABEL[t];
  const deluxeLabel = DELUXE_PRICE_LABEL[t];
  const productionLabel = PRODUCTION_PRICE_LABEL[t];

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

  async function startCheckout(): Promise<void> {
    if (requesting) return;
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, plan }),
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
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-jade">
        {tr.paywall.previewLabelPrefix}{PREVIEW_SECONDS}{tr.paywall.previewLabelSuffix}
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

        {/* Good-better-best: pick Standard or Deluxe. */}
        <div className="mt-4 space-y-3 text-left">
          <button
            type="button"
            onClick={() => setPlan("full")}
            aria-pressed={plan === "full"}
            className={`block w-full rounded-2xl border p-4 text-left transition ${
              plan === "full"
                ? "border-jade bg-warm-soft ring-1 ring-jade"
                : "border-sand bg-cream hover:border-jade"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">{tr.paywall.standard}</span>
              <span className="text-sm font-extrabold text-ink">{fullLabel}</span>
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
            className={`block w-full rounded-2xl border p-4 text-left transition ${
              plan === "deluxe"
                ? "border-gold bg-warm-soft ring-1 ring-gold"
                : "border-sand bg-cream hover:border-gold"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">
                {tr.paywall.deluxe} <span className="ml-1 rounded-full bg-warm-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{tr.paywall.mostChosen}</span>
              </span>
              <span className="text-sm font-extrabold text-ink">{deluxeLabel}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletEverythingStandard}</span></li>
              <li className="flex items-start gap-2"><span className="text-gold">★</span><span className="font-semibold">{tr.paywall.bulletSlideshow}</span></li>
            </ul>
          </button>

          <button
            type="button"
            onClick={() => setPlan("production")}
            aria-pressed={plan === "production"}
            className={`block w-full rounded-2xl border p-4 text-left transition ${
              plan === "production"
                ? "border-blush bg-warm-soft ring-1 ring-blush"
                : "border-sand bg-cream hover:border-blush"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">
                {tr.paywall.production} <span aria-hidden>🎬</span>
              </span>
              <span className="text-sm font-extrabold text-ink">{productionLabel}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{tr.paywall.bulletEverythingDeluxe}</span></li>
              <li className="flex items-start gap-2"><span className="text-blush">☎</span><span className="font-semibold">{tr.paywall.bulletCall}</span></li>
            </ul>
          </button>
        </div>

        {/* Live-musician anchor — makes the tiers read as the smart middle. */}
        <p className="mt-3 text-center text-[11px] text-ink-soft">
          {tr.paywall.liveAnchorLabel}{" "}
          <span className="font-bold text-ink">{LIVE_ANCHOR_PRICE_LABEL}</span>
        </p>

        <button
          type="button"
          onClick={startCheckout}
          disabled={requesting}
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
            `${tr.paywall.unlockProductionPrefix} · ${productionLabel} →`
          ) : plan === "deluxe" ? (
            `${tr.paywall.unlockDeluxePrefix} · ${deluxeLabel} →`
          ) : (
            `${tr.paywall.unlockStandardPrefix} · ${fullLabel} →`
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-jade">
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
