"use client";

// The Premiere — the one deliberately engineered PEAK of the reimagined flow.
//
// Instead of "an audio player appeared", the song is revealed as a one-night-only
// premiere: the stage darkens, curtains part, the recipient's name lands in the
// spotlight, confetti bursts, and a real audio-reactive equalizer dances to THEIR
// song. The sender is credited as the director — so both people feel special.
//
// Zero extra dependencies: pure React + Web Audio (AnalyserNode) + Canvas + CSS.
// GSAP can layer in later for richer sequencing; CSS transforms already hold 60fps.
//
// Audio + AnalyserNode note: reading frequency data requires a SAME-ORIGIN (or
// CORS-enabled) audio source. In the real flow, pass audio through the existing
// same-origin proxy (toAudioProxyUrl) so the visualizer reacts to real sound; a
// cross-origin/tainted source silently falls back to a synthetic idle animation.

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Overridable copy. The component ships Russian defaults so the standalone
 * /premiere preview keeps working untouched; the real multi-language flow passes
 * localized strings from the i18n dictionaries (there is no Russian dictionary,
 * so leaving the defaults visible in-flow would be a bug — always override).
 */
export type PremiereLabels = {
  /** Overline above the pre-show teaser. */
  overline?: string;
  /** Teaser line, split around the star's name: `{introPrefix}{name}{introSuffix}`. */
  introPrefix?: string;
  introSuffix?: string;
  /** The "start the show" button. */
  openCta?: string;
  /** Overline above the star's name on the open stage. */
  marqueeOverline?: string;
  /** Play-toggle labels. */
  pause?: string;
  replay?: string;
  /** Producer-credit prefix, rendered before the bold director name. */
  director?: string;
  /** Overline on the director's closing note card. */
  noteLabel?: string;
  /** Play/pause labels for the recorded voice note. */
  notePlay?: string;
  notePause?: string;
  /** Credits-roll row labels. */
  starringLabel?: string;
  producedByLabel?: string;
  withLoveLabel?: string;
};

export type PremiereRevealProps = {
  /** The star of the show. */
  recipientName: string;
  /** Who produced it — the sender. Rendered in the closing credit. */
  directorName?: string;
  /** Playable audio URL. Prefer a same-origin proxied URL for the visualizer. */
  audioSrc?: string;
  /** Optional song title shown under the name. */
  songTitle?: string;
  /**
   * The director's private message, revealed as the CLOSING beat once the
   * curtains are open. `text` shows on-screen; `voiceUrl` adds a play button
   * for the recorded spoken message (played on demand, after the song). Either
   * or both may be present; omit to hide the note entirely.
   */
  directorNote?: { text?: string; voiceUrl?: string; voiceDurationSec?: number };
  /**
   * Names credited in the closing "credits roll" (e.g. crowd contributors).
   * Shown under a "With love from" row. Omit/empty to hide that row.
   */
  contributors?: string[];
  /** Continue CTA label + handler (e.g. "Send it to them"). */
  continueLabel?: string;
  onContinue?: () => void;
  /** Localized copy overrides (see {@link PremiereLabels}). */
  labels?: PremiereLabels;
  /**
   * Cap playback at this many seconds. Preserves the paywall's free-preview gate
   * when the premiere plays the full-song source before unlock: playback pauses
   * and clamps at the cap and cannot be seeked past it. Omit to play in full.
   */
  previewSeconds?: number;
  /** Fired once when {@link previewSeconds} is first reached. */
  onPreviewLimit?: () => void;
};

type Phase = "closed" | "revealing" | "open";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function PremiereReveal({
  recipientName,
  directorName,
  audioSrc,
  songTitle,
  directorNote,
  contributors,
  continueLabel = "Send it to them 💌",
  onContinue,
  labels,
  previewSeconds,
  onPreviewLimit,
}: PremiereRevealProps) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [playing, setPlaying] = useState(false);
  const [playingNote, setPlayingNote] = useState(false);

  // Resolve copy once, falling back to English defaults (the real flow and the
  // /premiere preview both pass localized `labels`; these are a safety net).
  const L = {
    overline: labels?.overline ?? "Premiere · opening night",
    introPrefix: labels?.introPrefix ?? "The premiere for ",
    introSuffix:
      labels?.introSuffix ??
      " is ready. Dim the lights, turn up the sound — and open on the first scene.",
    openCta: labels?.openCta ?? "🎬 Start the premiere",
    marqueeOverline: labels?.marqueeOverline ?? "Tonight’s star",
    pause: labels?.pause ?? "⏸ Pause",
    replay: labels?.replay ?? "▶ Play again",
    director: labels?.director ?? "Produced by",
    noteLabel: labels?.noteLabel ?? "A message from the director",
    notePlay: labels?.notePlay ?? "▶ Play their message",
    notePause: labels?.notePause ?? "⏸ Pause",
    starringLabel: labels?.starringLabel ?? "Starring",
    producedByLabel: labels?.producedByLabel ?? "Produced & directed by",
    withLoveLabel: labels?.withLoveLabel ?? "With love from",
  };

  const noteText = directorNote?.text?.trim();
  const noteVoiceUrl = directorNote?.voiceUrl?.trim();
  const contributorNames = (contributors ?? []).map((n) => n.trim()).filter(Boolean);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const noteAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewFiredRef = useRef(false); // one-shot guard for onPreviewLimit
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<HTMLCanvasElement | null>(null);

  // Web Audio graph (created lazily on the user gesture that starts playback).
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const reactiveRef = useRef(false); // did we get real frequency data?

  const star = (recipientName || "the star").trim();
  const director = (directorName || "").trim();

  // ---- Audio-reactive equalizer (Canvas 2D) ----------------------------------
  // One RAF loop, defined locally so it can self-schedule without a forward
  // reference. Reads refs each frame; falls back to a synthetic idle wave when
  // there's no real frequency data (not playing yet, or a tainted source).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const BARS = 40;

    const render = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);

          let values: number[] = [];
          if (analyser) {
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            const sum = data.reduce((a, b) => a + b, 0);
            if (sum > 0) reactiveRef.current = true;
            const step = Math.floor(data.length / BARS) || 1;
            values = Array.from({ length: BARS }, (_, i) => data[i * step] / 255);
          }
          if (!reactiveRef.current || values.length === 0) {
            const t = Date.now() / 260;
            values = Array.from({ length: BARS }, (_, i) => {
              const base = Math.sin(t + i * 0.5) * 0.5 + 0.5;
              const shimmer = Math.sin(t * 1.7 + i) * 0.15;
              return Math.max(0.06, base * 0.7 + shimmer);
            });
          }

          const gap = 3;
          const barW = (w - gap * (BARS - 1)) / BARS;
          for (let i = 0; i < BARS; i++) {
            const barH = Math.max(3, values[i] * h * 0.92);
            const x = i * (barW + gap);
            const y = (h - barH) / 2;
            const grad = ctx.createLinearGradient(0, y, 0, y + barH);
            grad.addColorStop(0, "#f59e0b"); // amber
            grad.addColorStop(0.5, "#ec4899"); // pink
            grad.addColorStop(1, "#a855f7"); // purple
            ctx.fillStyle = grad;
            roundRect(ctx, x, y, barW, barH, Math.min(barW / 2, 3));
            ctx.fill();
          }
        }
      }
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---- Confetti (self-contained, no dependency) ------------------------------
  const burstConfetti = useCallback(() => {
    if (prefersReducedMotion()) return;
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (canvas.width = canvas.clientWidth * dpr);
    const H = (canvas.height = canvas.clientHeight * dpr);
    const colors = ["#f59e0b", "#ec4899", "#a855f7", "#ffffff", "#1f8e7d"];
    const pieces = Array.from({ length: 130 }, () => ({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.4,
      w: (6 + Math.random() * 7) * dpr,
      h: (10 + Math.random() * 8) * dpr,
      c: colors[(Math.random() * colors.length) | 0],
      vy: (2 + Math.random() * 3.5) * dpr,
      vx: (Math.random() - 0.5) * 2.4 * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }));
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 3200);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < 3200) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    tick();
  }, []);

  // ---- Start the show (user gesture: create AudioContext + play) -------------
  const beginShow = useCallback(async () => {
    setPhase("revealing");

    const audio = audioRef.current;
    if (audio && audioSrc) {
      try {
        if (!ctxRef.current) {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AC();
          const source = ctx.createMediaElementSource(audio);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          analyser.connect(ctx.destination);
          ctxRef.current = ctx;
          analyserRef.current = analyser;
        }
        await ctxRef.current.resume();
        await audio.play();
        setPlaying(true);
      } catch {
        // Autoplay/CORS trouble — the reveal still runs, visualizer idles.
      }
    }

    // Curtains part, then confetti at the peak.
    const delay = prefersReducedMotion() ? 0 : 650;
    window.setTimeout(() => {
      setPhase("open");
      burstConfetti();
    }, delay);
  }, [audioSrc, burstConfetti]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // Replaying a consumed preview: restart the clip from the top so the
      // 15s preview stays repeatable instead of dead-ending at the cap.
      if (previewSeconds != null && audio.currentTime >= previewSeconds) {
        audio.currentTime = 0;
      }
      await ctxRef.current?.resume();
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [previewSeconds]);

  // The director's recorded closing message — a plain, separate <audio>, played
  // on demand (kept out of the Web Audio graph so it never affects the song's
  // visualizer). Pauses the song first so they don't overlap.
  const toggleNote = useCallback(async () => {
    const note = noteAudioRef.current;
    if (!note) return;
    if (note.paused) {
      const song = audioRef.current;
      if (song && !song.paused) {
        song.pause();
        setPlaying(false);
      }
      try {
        await note.play();
        setPlayingNote(true);
      } catch {
        // playback blocked — no-op
      }
    } else {
      note.pause();
      setPlayingNote(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => undefined);
    };
  }, []);

  const opened = phase === "open";

  return (
    <div className="relative mx-auto w-full max-w-[560px] select-none">
      {/* Stage */}
      <div
        className="relative overflow-hidden rounded-[28px] border border-white/10 shadow-2xl"
        style={{
          minHeight: 480,
          background:
            "radial-gradient(680px 340px at 50% -8%, #2f1b42 0%, #1a1020 48%, #120b16 100%)",
        }}
      >
        {/* confetti layer */}
        <canvas
          ref={confettiRef}
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
        />

        {/* spotlight */}
        <div
          className="pointer-events-none absolute left-1/2 top-[-60px] z-10 h-[320px] w-[320px] -translate-x-1/2 transition-opacity duration-700"
          style={{
            opacity: opened ? 1 : 0.35,
            background:
              "radial-gradient(circle, rgba(245,158,11,0.28), transparent 62%)",
          }}
        />

        {/* content */}
        <div className="relative z-20 flex min-h-[480px] flex-col items-center justify-center px-6 py-10 text-center">
          {!opened && (
            <div
              className="transition-opacity duration-500"
              style={{ opacity: phase === "revealing" ? 0 : 1 }}
            >
              <p className="text-[13px] font-extrabold uppercase tracking-[0.28em] text-amber-300/90">
                {L.overline}
              </p>
              <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-amber-100/75">
                {L.introPrefix}
                {star}
                {L.introSuffix}
              </p>
              <button
                type="button"
                onClick={beginShow}
                className="mt-7 inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-base font-extrabold text-[#2a0f22] shadow-[0_16px_40px_-12px_rgba(236,72,153,0.6)] transition hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(120deg,#f59e0b,#ec4899)",
                }}
              >
                {L.openCta}
              </button>
            </div>
          )}

          {/* Marquee — appears as curtains open */}
          <div
            className="transition-all duration-700"
            style={{
              opacity: opened ? 1 : 0,
              transform: opened ? "translateY(0)" : "translateY(14px)",
            }}
          >
            <p className="text-[13px] font-extrabold uppercase tracking-[0.28em] text-amber-300">
              {L.marqueeOverline}
            </p>
            <h1
              className="mt-2 text-[44px] font-black leading-[1.02]"
              style={{
                background:
                  "linear-gradient(120deg,#ffffff,#ffd98a 40%,#ec4899)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 0 30px rgba(236,72,153,0.25)",
              }}
            >
              {star}
            </h1>
            {songTitle && (
              <p className="mt-1 text-sm italic text-amber-100/75">
                «{songTitle}»
              </p>
            )}

            {/* audio-reactive equalizer */}
            <canvas
              ref={canvasRef}
              className="mx-auto mt-5 h-[64px] w-[280px]"
              aria-hidden
            />

            {audioSrc && (
              <button
                type="button"
                onClick={togglePlay}
                className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-bold text-amber-50 transition hover:border-amber-300"
              >
                {playing ? L.pause : L.replay}
              </button>
            )}

            {director && (
              <p className="mt-5 text-[13px] text-amber-100/75">
                {L.director} <b className="text-amber-100">{director}</b> 🎬
              </p>
            )}

            {/* The director's private note — the closing beat. Text and/or a
                recorded voice message played on demand. */}
            {(noteText || noteVoiceUrl) && (
              <div className="mx-auto mt-6 max-w-[380px] rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-left">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber-300">
                  {L.noteLabel}
                </p>
                {noteText && (
                  <p className="mt-1.5 text-[15px] italic leading-relaxed text-amber-50">
                    “{noteText}”
                  </p>
                )}
                {noteVoiceUrl && (
                  <button
                    type="button"
                    onClick={toggleNote}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-amber-50 transition hover:border-amber-300"
                  >
                    {playingNote ? L.notePause : L.notePlay}
                  </button>
                )}
              </div>
            )}

            {/* Credits roll — starring, produced by, and the cast. */}
            <div className="mx-auto mt-6 max-w-[380px] border-t border-white/10 pt-4">
              <CreditRow label={L.starringLabel} value={star} />
              {director && <CreditRow label={L.producedByLabel} value={director} />}
              {contributorNames.length > 0 && (
                <CreditRow
                  label={L.withLoveLabel}
                  value={
                    contributorNames.slice(0, 8).join(" · ") +
                    (contributorNames.length > 8 ? " …" : "")
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* Curtains */}
        <Curtain side="left" open={phase !== "closed"} />
        <Curtain side="right" open={phase !== "closed"} />

        {/* hidden audio element */}
        {audioSrc && (
          <audio
            ref={audioRef}
            src={audioSrc}
            crossOrigin="anonymous"
            preload="auto"
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              // Free-preview gate: hold playback at the cap and surface the
              // unlock CTA once. Mirrors the pre-premiere flat player so the
              // paywall is preserved when the full-song source is played.
              if (previewSeconds == null) return;
              const el = e.currentTarget;
              if (el.currentTime >= previewSeconds) {
                el.pause();
                el.currentTime = previewSeconds;
                setPlaying(false);
                if (!previewFiredRef.current) {
                  previewFiredRef.current = true;
                  onPreviewLimit?.();
                }
              }
            }}
            onSeeking={(e) => {
              if (previewSeconds == null) return;
              const el = e.currentTarget;
              if (el.currentTime > previewSeconds) el.currentTime = previewSeconds;
            }}
          />
        )}

        {/* hidden director-note audio (played on demand, not visualized) */}
        {noteVoiceUrl && (
          <audio
            ref={noteAudioRef}
            src={noteVoiceUrl}
            preload="none"
            onEnded={() => setPlayingNote(false)}
            onPause={() => setPlayingNote(false)}
          />
        )}
      </div>

      {/* Continue */}
      {opened && onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="mt-5 w-full rounded-2xl px-6 py-4 text-base font-extrabold text-[#2a0f22] shadow-lg transition hover:-translate-y-0.5"
          style={{ background: "linear-gradient(120deg,#c9a24b,#ec4899)" }}
        >
          {continueLabel}
        </button>
      )}
    </div>
  );
}

function CreditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 first:mt-0 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-200/55">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-extrabold text-amber-50">{value}</p>
    </div>
  );
}

function Curtain({ side, open }: { side: "left" | "right"; open: boolean }) {
  const isLeft = side === "left";
  return (
    <div
      aria-hidden
      className="absolute top-0 z-[15] h-full"
      style={{
        width: "52%",
        [isLeft ? "left" : "right"]: 0,
        background:
          "repeating-linear-gradient(90deg,#7a1533 0,#7a1533 16px,#5e0f27 16px,#5e0f27 32px)",
        boxShadow: isLeft
          ? "inset -22px 0 44px rgba(0,0,0,0.45)"
          : "inset 22px 0 44px rgba(0,0,0,0.45)",
        transform: open
          ? `translateX(${isLeft ? "-102%" : "102%"})`
          : "translateX(0)",
        transition: "transform 1.4s cubic-bezier(0.7,0,0.3,1)",
      }}
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
