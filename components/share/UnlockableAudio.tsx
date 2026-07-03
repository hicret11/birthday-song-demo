"use client";

import { useRef, useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";

const PREVIEW_SECONDS = 15;

type Plan = "full" | "deluxe";

// Display-only mirror of TIER_PRICE_DISPLAY / TIER_PRICE_DISPLAY_DELUXE in
// lib/pricing-tiers.ts. The real charge is always the Stripe price_id; keep
// these in sync for the CTA labels.
const FULL_PRICE_LABEL: Record<"A" | "B" | "C", string> = { A: "$9.99", B: "$5.99", C: "$2.99" };
const DELUXE_PRICE_LABEL: Record<"A" | "B" | "C", string> = { A: "$14.99", B: "$9.99", C: "$5.99" };

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
   * Deluxe bonus: force-download URL for the untouched full-length track. When
   * present (unlocked Deluxe only) an extra download link is shown beneath the
   * Standard MP3. The player itself always plays the tight highlight cut.
   */
  fullAudioSrc?: string;
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
  fullAudioSrc,
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
        <audio
          ref={audioRef}
          controls
          src={audioSrc}
          className="w-full"
        />
        <a
          href={audioSrc}
          download
          className="mt-3 block w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-center text-sm font-bold transition hover:bg-white/15"
        >
          <span aria-hidden>⬇</span> Download MP3
        </a>
        {fullAudioSrc && (
          <a
            href={fullAudioSrc}
            download
            className="mt-2 block w-full rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-3 text-center text-sm font-bold text-amber-100 transition hover:bg-amber-400/15"
          >
            <span aria-hidden>★</span> Download full-length version
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-300">
        {tr.paywall.previewLabelPrefix}{PREVIEW_SECONDS}{tr.paywall.previewLabelSuffix}
      </p>
      <audio
        ref={audioRef}
        controls
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        className="w-full"
      />

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
        <p className="text-base font-extrabold">
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
                ? "border-fuchsia-300/70 bg-fuchsia-500/10 ring-1 ring-fuchsia-300/40"
                : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold">{tr.paywall.standard}</span>
              <span className="text-sm font-extrabold">{fullLabel}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-300">✓</span><span>{tr.paywall.bulletCompleteSong}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-300">✓</span><span>{tr.paywall.bulletMp3}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-300">✓</span><span>{tr.paywall.bulletShareVideo}</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-300">✓</span><span>{tr.paywall.bulletReplay}</span></li>
            </ul>
          </button>

          <button
            type="button"
            onClick={() => setPlan("deluxe")}
            aria-pressed={plan === "deluxe"}
            className={`block w-full rounded-2xl border p-4 text-left transition ${
              plan === "deluxe"
                ? "border-amber-300/70 bg-amber-400/10 ring-1 ring-amber-300/40"
                : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold">
                {tr.paywall.deluxe} <span className="ml-1 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{tr.paywall.bestValue}</span>
              </span>
              <span className="text-sm font-extrabold">{deluxeLabel}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-300">✓</span><span>{tr.paywall.bulletEverythingStandard}</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-300">★</span><span className="font-semibold">{tr.paywall.bulletSlideshow}</span></li>
            </ul>
          </button>
        </div>

        <button
          type="button"
          onClick={startCheckout}
          disabled={requesting}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-5 py-4 text-base font-extrabold text-white shadow-2xl shadow-fuchsia-500/30 transition hover:-translate-y-0.5 hover:shadow-fuchsia-500/50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {requesting ? (
            <>
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              {tr.paywall.openingCheckout}
            </>
          ) : plan === "deluxe" ? (
            `${tr.paywall.unlockDeluxePrefix} · ${deluxeLabel} →`
          ) : (
            `${tr.paywall.unlockStandardPrefix} · ${fullLabel} →`
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300">
          <span aria-hidden>✓</span>{" "}
          <a href="/refund" target="_blank" rel="noopener noreferrer" className="underline decoration-emerald-300/40 underline-offset-2 hover:decoration-emerald-300">
            {tr.paywall.moneyBack}
          </a>
        </p>
        <p className="mt-1 text-[11px] opacity-60">
          {tr.paywall.secureCheckout}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
