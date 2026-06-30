"use client";

import { useRef, useState } from "react";

const PREVIEW_SECONDS = 20;

type Props = {
  shareId: string;
  audioSrc: string;
  unlocked: boolean;
  recipientName: string;
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
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ shareId }),
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
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-300">
        🎁 Free preview · first 20 seconds
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
            ? `That's the preview — hear the whole thing for ${recipientName}`
            : `Unlock the full birthday song for ${recipientName}`}
        </p>
        <p className="mt-1 text-sm opacity-75">
          Full song, MP3 download, video and slideshow — yours forever.
        </p>
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
              Starting checkout…
            </>
          ) : (
            "Unlock the full song →"
          )}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
