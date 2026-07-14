"use client";

import { useRef, useState } from "react";

/**
 * The unlocked premiere = the rendered video itself (curtain → name → karaoke →
 * credits are all baked into the MP4). Shown with a single "Start the premiere"
 * play overlay so it stays one experience — no separate audio reveal, no double
 * playback. Used only when the song is unlocked and a video has rendered; the
 * animated SharePremiere reveal remains the fallback for the locked preview.
 */
export default function PremiereVideo({
  src,
  onFirstPlay,
}: {
  src: string;
  onFirstPlay?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function start() {
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    v.play().catch(() => {
      /* autoplay blocked — controls are now visible so the user can hit play */
    });
  }

  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl bg-black shadow-lg">
      <video
        ref={ref}
        src={src}
        controls={started}
        playsInline
        preload="metadata"
        onPlay={onFirstPlay}
        className="block w-full"
      />
      {!started && (
        <button
          type="button"
          onClick={start}
          aria-label="Start the premiere"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/25 via-black/10 to-black/55 transition hover:from-black/15 hover:to-black/45"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
            Premiere · Opening night
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-6 py-3 text-base font-extrabold text-ink shadow-[0_16px_40px_-12px_rgba(236,72,153,0.7)]">
            🎬 Start the premiere
          </span>
        </button>
      )}
    </div>
  );
}
