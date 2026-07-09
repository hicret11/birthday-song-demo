"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CakeStyle,
  CandleColor,
  GenerateLyricsResponse,
  GenerateMusicRequest,
  GenerateMusicResponse,
  GenerateSongRequest,
  Language,
  LyricSectionTag,
  Lyrics,
  ShareCreateRequest,
  ShareCreateResponse,
  ShareTemplate,
  SongStatusResponse,
  WaitCapture,
  WaitCaptureLocation,
  WaitCaptureRelationship,
} from "@/lib/api-types";
import Image from "next/image";
import {
  CAKE_STYLES,
  CANDLE_COLORS,
  PERSONAL_NOTE_MAX_LEN,
  SHARE_TEMPLATES,
  WAIT_CAPTURE_LOCATIONS,
  WAIT_CAPTURE_RELATIONSHIPS,
} from "@/lib/api-types";
import { toAudioProxyUrl } from "@/lib/audio-proxy";
import Confetti from "@/components/Confetti";
import PremiereReveal from "@/components/premiere/PremiereReveal";
import ThemeToggle from "@/components/ThemeToggle";
import {
  FULL_PRICE_LABEL as TIER_PRICE_LABEL,
  DELUXE_PRICE_LABEL,
  PRODUCTION_PRICE_LABEL,
  LIVE_ANCHOR_PRICE_LABEL,
} from "@/lib/pricing-display";
import ProductionCallFields, {
  isProductionCallReady,
  consentAttestationText,
  type ProductionCallValue,
} from "@/components/share/ProductionCallFields";
import { track } from "@vercel/analytics";
import { getAnonId, logClientEvent } from "@/lib/client-events";
import { getDictionary, type Locale } from "@/lib/i18n";

// Studio-style stages — read like the song is genuinely being produced for
// them, which builds anticipation (and makes the ~60s wait feel like progress
// rather than a spinner). Kept warm + on-brand with a couple of birthday beats.
const LOADING_MESSAGES = [
  "Composing their melody…",
  "Laying down the beat…",
  "Recording the vocals…",
  "Weaving their name into the chorus…",
  "Sprinkling on the candles…",
  "Mixing it all together…",
  "✨ Adding the final sparkle…",
];

// Gate for the visual cake + candle pickers in the "Make it Yours" panel.
// Default OFF — the overlay render path was rolled back because templates
// already include cake/candle imagery and overlays conflicted visually.
// Set NEXT_PUBLIC_ENABLE_VISUAL_PICKS="true" in Vercel env to re-expose the
// pickers once a future visual pass lands.
const VISUAL_PICKS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_VISUAL_PICKS === "true";

const CAPTURE_DONE_KEY = "bday_capture_done";
const CAPTURE_AGE_KEY = "bday_target_age";
const CAPTURE_EMAIL_KEY = "bday_email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recipient age bounds — the recipient is "turning" this age. Mirror these
// limits server-side in /api/waitlist so the consent log stays consistent.
const MIN_AGE = 1;
const MAX_AGE = 120;

// Public R2 prefix where short genre samples live, e.g.
// `${SAMPLES_BASE_URL}/pop.mp3`. Set NEXT_PUBLIC_R2_SAMPLES_BASE in Vercel
// env when the team uploads samples (path inside the bucket should be
// `shares/samples/<genre>.mp3`). Empty/undefined = sample panel is hidden.
const SAMPLES_BASE_URL = process.env.NEXT_PUBLIC_R2_SAMPLES_BASE ?? "";
const SAMPLE_MAX_SECONDS = 15;

// Map the emoji-prefixed genre labels to the filename slug we expect on R2.
function sampleSlugForGenre(genre: string | null | undefined): string | null {
  if (!genre) return null;
  const clean = genre.replace(/^[^\p{L}]+/u, "").trim().toLowerCase();
  if (!clean) return null;
  if (clean === "r&b") return "rnb";
  if (clean === "hip-hop") return "hip-hop";
  return clean.replace(/[^a-z0-9-]/g, "");
}

function sampleUrlForGenre(genre: string | null | undefined): string | null {
  if (!SAMPLES_BASE_URL) return null;
  const slug = sampleSlugForGenre(genre);
  if (!slug) return null;
  return `${SAMPLES_BASE_URL.replace(/\/$/, "")}/${slug}.mp3`;
}

// Parse the free-typed age input into a validated integer, or null when the
// field is empty / out of the accepted 1-120 range.
function parseRecipientAge(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const age = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return null;
  return age;
}

type EditableSection = { tag: LyricSectionTag; text: string };

// Typewriter cadence for the live-lyric reveal during the music wait.
// 50ms/char × ~500 chars of a typical short lyric ≈ 25s — slots cleanly
// into the ~60s Suno window.
const TYPEWRITER_MS_PER_CHAR = 50;

// Brand-aligned hex values for the candle picker. Order matches CANDLE_COLORS.
const CANDLE_HEX: Record<CandleColor, string> = {
  pink: "#ec4899",
  purple: "#a855f7",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#facc15",
  orange: "#f59e0b",
  red: "#ef4444",
};

const CAKE_LABELS: Record<CakeStyle, string> = {
  chocolate: "Chocolate",
  vanilla: "Vanilla",
  rainbow: "Rainbow",
  custom: "Surprise",
};

// Tiny inline SVG cake icons — kept here rather than as separate files so
// the wait-state stays self-contained and there's no extra HTTP round-trip
// to load decorative imagery during the 60s wait.
function CakeIcon({ style, selected }: { style: CakeStyle; selected: boolean }) {
  const ring = selected ? "ring-2 ring-white/80" : "ring-1 ring-white/15";
  if (style === "chocolate") {
    return (
      <div className={`rounded-xl bg-[#3a221a] p-2 ${ring}`}>
        <svg viewBox="0 0 40 40" className="h-10 w-10">
          <rect x="6" y="20" width="28" height="14" rx="2" fill="#6b3a23" />
          <rect x="6" y="20" width="28" height="3" fill="#8b5a3a" />
          <rect x="19" y="10" width="2" height="10" fill="#facc15" />
          <circle cx="20" cy="9" r="2" fill="#fb923c" />
        </svg>
      </div>
    );
  }
  if (style === "vanilla") {
    return (
      <div className={`rounded-xl bg-[#fef3c7] p-2 ${ring}`}>
        <svg viewBox="0 0 40 40" className="h-10 w-10">
          <rect x="6" y="20" width="28" height="14" rx="2" fill="#fff7e0" />
          <rect x="6" y="20" width="28" height="3" fill="#ffe4a3" />
          <rect x="19" y="10" width="2" height="10" fill="#facc15" />
          <circle cx="20" cy="9" r="2" fill="#fb923c" />
        </svg>
      </div>
    );
  }
  if (style === "rainbow") {
    return (
      <div className={`rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-amber-400 p-2 ${ring}`}>
        <svg viewBox="0 0 40 40" className="h-10 w-10">
          <rect x="6" y="20" width="28" height="3.5" fill="#ec4899" />
          <rect x="6" y="23.5" width="28" height="3.5" fill="#a855f7" />
          <rect x="6" y="27" width="28" height="3.5" fill="#3b82f6" />
          <rect x="6" y="30.5" width="28" height="3.5" fill="#facc15" />
          <rect x="19" y="10" width="2" height="10" fill="white" />
          <circle cx="20" cy="9" r="2" fill="#fb923c" />
        </svg>
      </div>
    );
  }
  // custom — playful question-mark
  return (
    <div className={`rounded-xl bg-white/5 p-2 ${ring}`}>
      <svg viewBox="0 0 40 40" className="h-10 w-10">
        <rect x="6" y="20" width="28" height="14" rx="2" fill="#a855f7" />
        <text
          x="20"
          y="32"
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
          fill="white"
          fontFamily="system-ui, sans-serif"
        >
          ?
        </text>
        <circle cx="20" cy="9" r="2" fill="#fb923c" />
        <rect x="19" y="10" width="2" height="10" fill="#facc15" />
      </svg>
    </div>
  );
}

const TEMPLATE_LABELS: Record<ShareTemplate, { name: string; desc: string }> = {
  classic: { name: "Classic", desc: "Bold & celebratory" },
  neon: { name: "Neon", desc: "Vibrant & glowing" },
  elegant: { name: "Elegant", desc: "Refined & golden" },
  playful: { name: "Playful", desc: "Fun & colorful" },
  corporate: { name: "Corporate", desc: "Polished & professional" },
};

// Tiny color anchors next to each template name in the picker — let the user
// see the design's accent at a glance without rendering the whole template.
const TEMPLATE_ACCENT: Record<ShareTemplate, string> = {
  classic: "#ec4899",
  neon: "#ff00ff",
  elegant: "#f5e070",
  playful: "#fb923c",
  corporate: "#ec4899",
};

// Preview-card styling (approximation of OVERLAY_STYLES from share/templates).
// Self-contained — no cross-component coupling.
const PREVIEW_BG: Record<ShareTemplate, string> = {
  classic: "bg-gradient-to-br from-[#1a0b2e] via-[#2d1248] to-[#3a1b1f]",
  elegant: "bg-[#0a0805]",
  neon: "bg-[#0d0521]",
  playful: "bg-gradient-to-br from-[#fb7185] to-[#fb923c]",
  corporate: "bg-gradient-to-br from-[#0b1220] to-[#1b2538]",
};
const PREVIEW_TEXT_STYLE: Record<ShareTemplate, React.CSSProperties> = {
  classic: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: "#fbcfe8",
    textShadow: "0 0 14px rgba(236,72,153,0.5)",
  },
  elegant: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: "#f5e070",
    textShadow: "0 2px 6px rgba(0,0,0,0.55)",
  },
  neon: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#ff66ff",
    textShadow: "0 0 10px #ff00ff, 0 0 20px #ff00ff",
  },
  playful: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#ffffff",
    textShadow: "2px 2px 0 rgba(0,0,0,0.35)",
  },
  corporate: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: "#ffffff",
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
};

type ThemeKey = "dark" | "light" | "party" | "pastel" | "luxury" | "confetti" | "balloons" | "bubbles";

// Relationship quick-pick chips are built from the i18n dictionary at render
// time (see `relationshipOptions` in the component). Each chip stores its own
// canonical label into the free-text `relationship` state; the data contract is
// unchanged — the backend still receives a single `relationship` string.

const POLL_INTERVAL_MS = 2_000;
const LONG_WAIT_HINT_MS = 90_000;
const GENERATION_TIMEOUT_MS = 180_000;

const genres = ["🎤 Pop", "🎷 R&B", "🎸 Rock", "🎹 Jazz", "🎧 Hip-Hop", "🎛️ Electronic"];
const languages = ["English", "Turkish", "Spanish", "French", "Arabic", "Hindi", "Russian"];

const themes = {
  // Warm "Modern Playful-Premium" palette. Every theme now maps onto the same
  // semantic warm tokens (bg-cream-soft / border-sand / text-ink …) so the flow
  // adapts to light+dark automatically via the .dark CSS tokens. The per-theme
  // `pageBg` swatch keeps a distinct warm tint just for the picker preview, and
  // `effect` / `emojis` still drive the canvas + floating decor.
  dark: {
    name: "Dark Neon",
    desc: "Vibrant & energetic",
    pageBg: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "emoji",
    emojis: ["🎵", "🎶", "🎂", "🎉", "🎁", "🎈", "✨", "🎊", "🥳", "🪩", "🍰", "🎤"],
  },
  light: {
    name: "Light Dream",
    desc: "Soft & clean",
    pageBg: "from-[#ffe3d2] via-[#ffd0dc] to-[#ffc9a3]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "emoji",
    emojis: ["☁️", "🎀", "🎂", "🎈", "✨", "💖", "🎶", "🧁", "🎁", "🌸", "🍰", "🎵"],
  },
  party: {
    name: "Birthday Party",
    desc: "Fun & colorful",
    pageBg: "from-[#ff8faa] via-[#ffc9a3] to-[#ff6f91]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "emoji",
    emojis: ["🎉", "🎊", "🥳", "🎈", "🎂", "🎁", "🍰", "✨", "🎵", "🪅", "🧁", "🎶"],
  },
  pastel: {
    name: "Soft Pastel",
    desc: "Calm & gentle",
    pageBg: "from-[#ffe3d2] via-[#ffd0dc] to-[#ffb7cc]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "emoji",
    emojis: ["🧸", "🎀", "🎂", "🎈", "✨", "🌈", "🎶", "🧁", "💖", "🎁", "🍭", "🎵"],
  },
  luxury: {
    name: "Luxury Night",
    desc: "Elegant & premium",
    pageBg: "from-[#c9a24b] via-[#ffc9a3] to-[#ff8faa]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "emoji",
    emojis: ["✨", "🌙", "🎂", "🎁", "🥂", "🎵", "🎶", "⭐", "🍰", "🎈", "💫", "🎉"],
  },
  confetti: {
    name: "Confetti",
    desc: "Classic party motion",
    pageBg: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "confetti",
    emojis: [],
  },
  balloons: {
    name: "Balloons",
    desc: "Floating birthday balloons",
    pageBg: "from-[#ffd0dc] via-[#ff8faa] to-[#ff6f91]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "balloons",
    emojis: [],
  },
  bubbles: {
    name: "Bubbles",
    desc: "Soft floating bubbles",
    pageBg: "from-[#ffe3d2] via-[#ffc6a4] to-[#ff8faa]",
    title: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    card: "bg-cream-soft border-sand backdrop-blur-md",
    text: "text-ink",
    sub: "text-ink-soft",
    input: "bg-cream-soft border-sand placeholder:text-ink-soft",
    accent: "from-[#ffcf6b] via-[#ff8ac0] to-[#ff3d90]",
    effect: "bubbles",
    emojis: [],
  },
};

export type VenueContext = {
  name: string;
  logo_color: string;
  slug: string;
};

type Props = {
  venue: VenueContext | null;
  locale?: Locale;
};

/**
 * Producer persona — a small avatar + speech bubble that turns the intake into a
 * guided conversation with "the producer" (matches the concept prototype's
 * Milo). Purely presentational; all copy comes from the dictionary. No essential
 * animation, so it is reduced-motion-safe by construction. The avatar carries the
 * prototype's cinematic gold→pink accent; the bubble sits on the warm palette so
 * it fits the surrounding flow.
 */
function ProducerBubble({
  emoji,
  children,
}: {
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl shadow-[0_8px_22px_-8px_rgba(255,120,180,0.7)]"
        style={{ background: "radial-gradient(circle at 30% 30%, #ffe6b0, #ff8ac0)" }}
      >
        {emoji}
      </div>
      <div className="rounded-[6px_18px_18px_18px] border border-sand bg-cream-soft px-4 py-3 text-sm leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

/**
 * Small cinematic "Act N ·" kicker label above a step — gold, uppercase, tracked.
 * Presentational only.
 */
function StudioKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold">
      {children}
    </p>
  );
}

// A floating target in the wait-time game.
type GameKind = "note" | "cake" | "gift" | "star" | "bomb";
type GameItem = { id: number; left: number; dur: number; kind: GameKind };
type ScorePop = { id: number; left: number; text: string; good: boolean };

const GAME_KINDS: { kind: GameKind; emoji: string; value: number; weight: number }[] = [
  { kind: "note", emoji: "🎵", value: 1, weight: 32 },
  { kind: "cake", emoji: "🎂", value: 1, weight: 20 },
  { kind: "gift", emoji: "🎁", value: 2, weight: 16 },
  { kind: "star", emoji: "🌟", value: 5, weight: 7 },
  { kind: "bomb", emoji: "💣", value: 0, weight: 11 },
];
const GAME_EMOJI: Record<GameKind, string> = {
  note: "🎵", cake: "🎂", gift: "🎁", star: "🌟", bomb: "💣",
};

function pickKind(): GameKind {
  const total = GAME_KINDS.reduce((s, k) => s + k.weight, 0);
  let r = Math.random() * total;
  for (const k of GAME_KINDS) {
    r -= k.weight;
    if (r <= 0) return k.kind;
  }
  return "note";
}

/**
 * "Catch the beat" — a zero-dependency wait-time game so the ~60–90s song
 * render feels like play, not a dead spinner. It runs as one flow: a short
 * "in the studio" intro, then the game auto-starts and runs until the song is
 * ready (this component unmounts, clearing its timers). Tap the treats to score;
 * consecutive catches build a combo multiplier; dodge the bombs. Purely for fun —
 * it never gates or delays generation, and it's skipped under reduced motion.
 */
function WaitGame() {
  const [reduced, setReduced] = useState(false);
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [items, setItems] = useState<GameItem[]>([]);
  const [pops, setPops] = useState<ScorePop[]>([]);
  const idRef = useRef(0);
  const startedAtRef = useRef(0);

  const multiplier = Math.min(5, 1 + Math.floor(combo / 4));

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time sync from a client-only matchMedia value; a render-time read would break hydration
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Intro → auto-start. A 3-2-1 countdown makes the hand-off feel intentional.
  useEffect(() => {
    if (reduced || typeof window === "undefined") return;
    if (countdown <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- terminal step of a timer-driven countdown state machine; restructuring would change the reveal timing
      setStarted(true);
      startedAtRef.current = Date.now();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 850);
    return () => window.clearTimeout(t);
  }, [countdown, reduced]);

  // Spawner — speeds up the longer the render runs, so it keeps escalating.
  useEffect(() => {
    if (!started || reduced || typeof window === "undefined") return;
    let timer = 0;
    const tick = () => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const ramp = Math.min(1, elapsed / 35); // 0 → 1 over ~35s
      setItems((prev) => {
        if (prev.length >= 10) return prev;
        const id = (idRef.current += 1);
        const dur = 4.6 - ramp * 1.7 + Math.random() * 0.8; // faster over time
        return [...prev, { id, left: 6 + Math.random() * 82, dur, kind: pickKind() }];
      });
      const gap = 820 - ramp * 360 + Math.random() * 160; // spawn faster over time
      timer = window.setTimeout(tick, gap);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [started, reduced]);

  if (reduced) return null;

  const remove = (id: number) => setItems((prev) => prev.filter((b) => b.id !== id));

  const addPop = (left: number, text: string, good: boolean) => {
    const id = (idRef.current += 1);
    setPops((prev) => [...prev, { id, left, text, good }]);
    window.setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 650);
  };

  const tap = (item: GameItem) => {
    remove(item.id);
    if (item.kind === "bomb") {
      setCombo(0);
      setScore((s) => Math.max(0, s - 2));
      addPop(item.left, "💥", false);
      return;
    }
    const base = GAME_KINDS.find((k) => k.kind === item.kind)?.value ?? 1;
    const gained = base * multiplier;
    setScore((s) => s + gained);
    setCombo((c) => c + 1);
    addPop(item.left, `+${gained}`, true);
  };

  return (
    <div className="mt-6" style={{ animation: "game-in 0.5s ease-out both" }}>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
          🎮 Catch the beat while you wait
        </p>
        <p className="flex items-center gap-2 text-xs font-extrabold text-jade">
          {multiplier > 1 && (
            <span className="rounded-full bg-warm-gradient px-2 py-0.5 text-[10px] text-white">
              🔥 x{multiplier}
            </span>
          )}
          <span>Score {score}</span>
        </p>
      </div>
      <div className="relative h-60 overflow-hidden rounded-2xl border border-sand bg-cream">
        {!started ? (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-3xl font-extrabold text-ink">{countdown}</p>
              <p className="mt-1 text-xs text-ink-soft">Catch 🎵🎂🎁🌟 · dodge 💣</p>
            </div>
          </div>
        ) : (
          <>
            {items.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-label={b.kind === "bomb" ? "Bomb — avoid" : "Catch"}
                onClick={() => tap(b)}
                onAnimationEnd={() => remove(b.id)}
                className="absolute bottom-0 grid h-12 w-12 place-items-center rounded-full text-3xl leading-none select-none"
                style={{
                  left: `${b.left}%`,
                  animation: `balloon-rise ${b.dur}s linear forwards`,
                  filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.14))",
                }}
              >
                <span aria-hidden>{GAME_EMOJI[b.kind]}</span>
              </button>
            ))}
            {pops.map((p) => (
              <span
                key={p.id}
                aria-hidden
                className={`pointer-events-none absolute bottom-16 text-sm font-extrabold ${
                  p.good ? "text-jade" : "text-blush"
                }`}
                style={{ left: `${p.left}%`, animation: "score-pop 0.65s ease-out forwards" }}
              >
                {p.text}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function GeneratorClient({ venue, locale = "en" }: Props) {
  const t = getDictionary(locale);
  // Presentational-only: controls the single "Add more details" expander that
  // replaced the Basic/Advanced tab toggle. Never gates or drives any logic.
  const [moreOpen, setMoreOpen] = useState(false);
  // Reimagined intake (v4 "production studio"): the opening name-in-lights
  // marquee, then a one-decision-per-screen beat engine. `intakeStage` and
  // `beatIndex` drive only the RENDER of step 1 — all captured values still
  // land in the same canonical state fields the backend contract expects.
  const [intakeStage, setIntakeStage] = useState<"opening" | "beats">("opening");
  const [beatIndex, setBeatIndex] = useState(0);
  // Birthday beat: month + day selects → next-birthday ISO stored in
  // waitBirthdayDate (deliveryMode stays "scheduled"). The ISO is computed in
  // the change handler (never during render — react-hooks/purity).
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [themeKey] = useState<ThemeKey>("dark");
  const [name, setName] = useState("");
  const [pronunciationHint, setPronunciationHint] = useState("");
  // Recorder warmup: MediaRecorder has 200-700ms of startup latency before the
  // codec is actually capturing audio (worst on iOS Safari). We start the
  // recorder immediately, discard the first 800ms of chunks (warmup), then
  // show the "Speak now!" UI and capture the next 4 seconds. The user gets a
  // full 4s of guaranteed-captured audio instead of losing the first syllable.
  const MIC_WARMUP_MS = 800;
  const MIC_RECORDING_CAP_MS = 4000;
  const MIC_CHUNK_INTERVAL_MS = 200;

  const [micState, setMicState] = useState<
    "idle" | "warming" | "recording" | "transcribing" | "error"
  >("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micWarmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micCanceledRef = useRef<boolean>(false);

  function clearMicTimers(): void {
    if (micWarmupTimerRef.current) {
      clearTimeout(micWarmupTimerRef.current);
      micWarmupTimerRef.current = null;
    }
    if (micStopTimerRef.current) {
      clearTimeout(micStopTimerRef.current);
      micStopTimerRef.current = null;
    }
  }

  function stopMicStream(): void {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }

  async function transcribeMicBlob(blob: Blob): Promise<void> {
    setMicState("transcribing");
    setMicError(null);
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `recording.${ext}`);
      const res = await fetch("/api/transcribe-name", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { phonetic?: string; error?: { message?: string } };
      if (res.ok && typeof data.phonetic === "string" && data.phonetic.length > 0) {
        setPronunciationHint(data.phonetic.slice(0, 80));
        setMicState("idle");
        return;
      }
      setMicError(data.error?.message ?? "Couldn't read the name. Try again or type it.");
      setMicState("error");
    } catch {
      setMicError("Couldn't reach the server. Try again or type it.");
      setMicState("error");
    }
  }

  async function startMicRecording(): Promise<void> {
    setMicError(null);
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { mediaDevices?: MediaDevices };
    if (!nav.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("Your browser can't record audio — type the pronunciation instead.");
      setMicState("error");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await nav.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("No mic access — type the pronunciation instead.");
      setMicState("error");
      return;
    }
    micStreamRef.current = stream;
    micChunksRef.current = [];
    micCanceledRef.current = false;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stopMicStream();
      setMicError("Your browser can't record audio — type the pronunciation instead.");
      setMicState("error");
      return;
    }
    micRecorderRef.current = recorder;
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) micChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const chunks = micChunksRef.current;
      micChunksRef.current = [];
      stopMicStream();
      clearMicTimers();
      if (micCanceledRef.current) {
        micCanceledRef.current = false;
        setMicState("idle");
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size === 0) {
        setMicError("No audio captured. Try again.");
        setMicState("error");
        return;
      }
      await transcribeMicBlob(blob);
    };

    // Start with a small timeslice so chunks fire periodically. This lets us
    // throw away the warmup chunks at the boundary; without timeslice, the
    // first dataavailable wouldn't fire until stop() and we couldn't
    // distinguish warmup from post-warmup audio.
    try {
      recorder.start(MIC_CHUNK_INTERVAL_MS);
    } catch {
      stopMicStream();
      setMicError("Your browser can't record audio — type the pronunciation instead.");
      setMicState("error");
      return;
    }

    setMicState("warming");

    micWarmupTimerRef.current = setTimeout(() => {
      // Discard the warmup chunks — codec was still stabilizing. The
      // post-warmup chunks that arrive after this point are what we send.
      micChunksRef.current = [];
      setMicState("recording");
      micStopTimerRef.current = setTimeout(() => {
        if (micRecorderRef.current && micRecorderRef.current.state === "recording") {
          micRecorderRef.current.stop();
        }
      }, MIC_RECORDING_CAP_MS);
    }, MIC_WARMUP_MS);
  }

  function stopMicRecording(): void {
    const rec = micRecorderRef.current;
    if (!rec || rec.state !== "recording") return;
    // Stopping during warmup = user canceled; flag onstop to abort the
    // transcribe step and just return to idle.
    if (micState === "warming") {
      micCanceledRef.current = true;
    }
    rec.stop();
  }

  useEffect(() => {
    return () => {
      clearMicTimers();
      stopMicStream();
    };
  }, []);

  // ── Casting: the feeling + the director's private note ───────────────────
  // `feeling` is the emotional target chosen during casting (steers copy/tone).
  // The director's note is the closing beat of the premiere — captured as text
  // OR a short voice clip. The clip is uploaded to Vercel Blob via
  // /api/audio/upload; only the returned URL + rounded duration are persisted.
  // All three are optional and never gate song creation.
  const [feeling, setFeeling] = useState("");
  const [noteMode, setNoteMode] = useState<"text" | "voice">("text");
  const [directorNoteText, setDirectorNoteText] = useState("");
  const [directorNoteVoiceUrl, setDirectorNoteVoiceUrl] = useState<string | null>(null);
  const [directorNoteVoiceDurationSec, setDirectorNoteVoiceDurationSec] =
    useState<number | null>(null);
  const [noteRecording, setNoteRecording] = useState(false);
  const [noteUploading, setNoteUploading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteStreamRef = useRef<MediaStream | null>(null);
  const noteChunksRef = useRef<Blob[]>([]);
  const noteStartMsRef = useRef<number>(0);
  const noteStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const NOTE_RECORDING_CAP_MS = 30_000;

  const feelingOptions = [
    { value: "goosebumps", label: t.generate.feelingGoosebumps },
    { value: "laughing", label: t.generate.feelingLaughing },
    { value: "happy tears", label: t.generate.feelingHappyCry },
    { value: "nostalgic", label: t.generate.feelingNostalgic },
    { value: "hyped up", label: t.generate.feelingHyped },
    { value: "deeply loved", label: t.generate.feelingLoved },
  ];

  async function uploadNoteBlob(blob: Blob, durationSec: number): Promise<void> {
    setNoteUploading(true);
    setNoteError(null);
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `director-note.${ext}`);
      const res = await fetch("/api/audio/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: { message?: string };
      };
      if (res.ok && typeof data.url === "string" && data.url.length > 0) {
        setDirectorNoteVoiceUrl(data.url);
        setDirectorNoteVoiceDurationSec(Math.max(1, Math.round(durationSec)));
        return;
      }
      setNoteError(data.error?.message ?? t.generate.noteErrUpload);
    } catch {
      setNoteError(t.generate.noteErrUpload);
    } finally {
      setNoteUploading(false);
    }
  }

  async function startNoteRecording(): Promise<void> {
    setNoteError(null);
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { mediaDevices?: MediaDevices };
    if (!nav.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNoteError(t.generate.noteErrNoMic);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await nav.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNoteError(t.generate.noteErrNoMic);
      return;
    }
    noteStreamRef.current = stream;
    noteChunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      noteStreamRef.current = null;
      setNoteError(t.generate.noteErrNoMic);
      return;
    }
    noteRecorderRef.current = recorder;
    noteStartMsRef.current = Date.now();
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) noteChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const chunks = noteChunksRef.current;
      noteChunksRef.current = [];
      noteStreamRef.current?.getTracks().forEach((track) => track.stop());
      noteStreamRef.current = null;
      if (noteStopTimerRef.current) {
        clearTimeout(noteStopTimerRef.current);
        noteStopTimerRef.current = null;
      }
      setNoteRecording(false);
      const durationSec = (Date.now() - noteStartMsRef.current) / 1000;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size === 0 || durationSec < 0.5) {
        setNoteError(t.generate.noteErrNoAudio);
        return;
      }
      await uploadNoteBlob(blob, durationSec);
    };
    try {
      recorder.start();
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      noteStreamRef.current = null;
      setNoteError(t.generate.noteErrNoMic);
      return;
    }
    setNoteRecording(true);
    noteStopTimerRef.current = setTimeout(() => {
      if (noteRecorderRef.current && noteRecorderRef.current.state === "recording") {
        noteRecorderRef.current.stop();
      }
    }, NOTE_RECORDING_CAP_MS);
  }

  function stopNoteRecording(): void {
    const rec = noteRecorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  }

  function clearNoteVoice(): void {
    setDirectorNoteVoiceUrl(null);
    setDirectorNoteVoiceDurationSec(null);
    setNoteError(null);
  }

  useEffect(() => {
    return () => {
      if (noteStopTimerRef.current) clearTimeout(noteStopTimerRef.current);
      noteStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Funnel analytics: fire once on mount so we can measure top-of-funnel
  // traffic to the generator. Best-effort — never throw into the UI.
  useEffect(() => {
    try {
      track("generate_page_view", { venue_slug: venue?.slug ?? "none" });
    } catch {
      // Analytics is non-critical; swallow.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
  const [senderName, setSenderName] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [attested, setAttested] = useState(false);
  // Optional opt-in for birthday reminders / occasional offers. Never shown or
  // sent on a child-recipient flow (see the gate below).
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Hydrate the recipient age from any prior session capture so returning
  // users don't re-type it.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CAPTURE_AGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time hydration from client-only sessionStorage; unavailable during SSR/render
      if (stored && parseRecipientAge(stored) !== null) setAgeInput(stored);
    } catch {
      // sessionStorage may be unavailable; carry on.
    }
  }, []);
  const [language, setLanguage] = useState<Language>("English");
  const [genre, setGenre] = useState("");
  const [relationship, setRelationship] = useState("");
  const [profession, setProfession] = useState("");
  const [memory, setMemory] = useState("");
  const [extras, setExtras] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  // Claude-refined Suno descriptor returned by /api/generate-music when the
  // user supplied free-text style notes. Forwarded to /api/share so the
  // refined string lives in KV and the regenerate route can reuse it.
  const [refinedStyle, setRefinedStyle] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [editableSections, setEditableSections] = useState<EditableSection[]>([]);
  const [resolvedGenre, setResolvedGenre] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [longWaitHint, setLongWaitHint] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [shareTemplate, setShareTemplate] = useState<ShareTemplate>("classic");
  // Optional wait-state capture. Empty values are fine — fields are purely
  // additive and never gate share creation. Forwarded to /api/share when
  // the auto-share fires on song completion.
  const [waitRelationship, setWaitRelationship] =
    useState<WaitCaptureRelationship | "">("");
  const [waitLocation, setWaitLocation] = useState<WaitCaptureLocation | "">("");
  const [waitYearReminder, setWaitYearReminder] = useState(false);
  // Optional recipient birthday ("YYYY-MM-DD" from <input type="date">). Drives
  // the annual reminder when the buyer also opts into the year reminder. Purely
  // additive — never blocks song creation or sharing.
  const [waitBirthdayDate, setWaitBirthdayDate] = useState("");
  // Countdown delivery (giver-sends): when a birthday is set, hold the premiere
  // behind a countdown until that day by default ("scheduled"), or reveal now.
  // The giver's IANA timezone is read client-side (unavailable during SSR).
  const [deliveryMode, setDeliveryMode] = useState<"now" | "scheduled">("scheduled");
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  const [premiereDeliverAt, setPremiereDeliverAt] = useState<string | null>(null);
  const [premierePreviewUrl, setPremierePreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only tz read; Intl resolves the giver's zone, unavailable during SSR
      setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      // Intl unavailable — delivery simply falls back to instant reveal.
    }
  }, []);
  // "While you wait" panels — both default collapsed so the main wait
  // surface stays clean. User opts in by tapping the header chevron.
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [samplePanelOpen, setSamplePanelOpen] = useState(false);
  // Sample audio ref so we can pause it when the real song arrives. Keeping
  // a single element instance also lets us enforce the 15-second auto-mute.
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  // "Make it Yours" picks — all optional. Forwarded to /api/share when the
  // auto-share fires; server validates against closed enums + length cap.
  const [cakeStyle, setCakeStyle] = useState<CakeStyle | null>(null);
  const [candleColor, setCandleColor] = useState<CandleColor | null>(null);
  const [personalNote, setPersonalNote] = useState("");
  // Typewriter reveal of Claude-returned lyrics during the music wait. Resets
  // whenever new lyrics arrive (so re-generates start the animation fresh).
  const [lyricRevealChars, setLyricRevealChars] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Optional promotional-use permission, offered only after a song is shareable
  // and never on minor-recipient flows. Best-effort; never blocks anything.
  const [promoGranted, setPromoGranted] = useState(false);
  const [promoSaved, setPromoSaved] = useState(false);
  // Whether the user has answered the feature opt-in (either way) — drives the
  // post-share card's confirmation state. Optional; never blocks anything.
  const [promoResponded, setPromoResponded] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Crowd-magic: mint a group-song gift BEFORE the song exists, so the
  // recipient's circle can add lines/memories via /join/[id] first. Entirely
  // optional — the solo flow never touches this.
  const [crowdJoinUrl, setCrowdJoinUrl] = useState<string | null>(null);
  const [crowdCreating, setCrowdCreating] = useState(false);
  const [crowdError, setCrowdError] = useState<string | null>(null);
  const [crowdCopied, setCrowdCopied] = useState(false);

  // ── Optional photo slideshow ────────────────────────────────────────────
  // Users may add up to 6 photos before unlocking; the URLs persist on the
  // share and the slideshow video is rendered after unlock. Entirely optional
  // and non-blocking — skipping is fine and never gates share creation.
  const MAX_SLIDESHOW_PHOTOS = 6;
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // ── Consumer paywall (preview → unlock) ─────────────────────────────────
  // The finished song plays as a free preview (first PREVIEW_SECONDS); the full
  // song + download + video + slideshow are unlocked via one-time Stripe
  // checkout. Tier comes back on the share response so the CTA can show the
  // geo-correct price. NOTE: this is a client-side gate (good enough for v1);
  // hardening = serve a real trimmed preview clip from /api/audio when locked.
  const [shareTier, setShareTier] = useState<"A" | "B" | "C" | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [unlockPlan, setUnlockPlan] = useState<"full" | "deluxe" | "production">("full");
  // Production-tier AI-call setup (character + recipient phone + optional date +
  // consent). Only read when unlockPlan === "production"; validated server-side.
  const [callSetup, setCallSetup] = useState<ProductionCallValue>({
    characterId: "",
    phone: "",
    date: "",
    consent: false,
  });
  const PREVIEW_SECONDS = 15;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<null | (() => void)>(null);
  const completeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recipientAge = parseRecipientAge(ageInput);
  const recipientIsMinor = recipientAge !== null && recipientAge < 18;

  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (!loadingMusic) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the rotating message to the first before the interval takes over; part of the loading subscription
    setLoadingMsgIdx(0);
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsgIdx(i);
    }, 4500);
    return () => clearInterval(interval);
  }, [loadingMusic]);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!audioUrl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fires a one-shot celebration animation triggered by the song's audio becoming ready
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, [audioUrl]);

  // Funnel analytics: the preview + unlock card become visible as soon as the
  // song's audio is ready. Fire once per song. Best-effort — never throws.
  const paywallViewedRef = useRef(false);
  useEffect(() => {
    if (!audioUrl) {
      paywallViewedRef.current = false;
      return;
    }
    if (paywallViewedRef.current) return;
    paywallViewedRef.current = true;
    try {
      track("paywall_viewed", {
        venue_slug: venue?.slug ?? "none",
        tier: shareTier ?? "unknown",
      });
    } catch {
      // Analytics is non-critical; swallow.
    }
  }, [audioUrl, shareTier, venue?.slug]);
  // Second confetti burst when the share artifact finally lands — gives the
  // "Open share page" button its own reveal moment after the audio reveal.
  useEffect(() => {
    if (!shareUrl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fires a one-shot celebration animation triggered by the share artifact landing
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 2500);
    return () => clearTimeout(t);
  }, [shareUrl]);

  // Pause the genre-sample strip when the real song lands. The real <audio>
  // also pauses the sample in its onPlay handler, but the sample should also
  // pause/reset the moment Suno returns regardless of whether the user hits
  // play immediately.
  useEffect(() => {
    if (!audioUrl) return;
    const el = sampleAudioRef.current;
    if (!el) return;
    try {
      el.pause();
    } catch {
      // No-op — pause errors are non-fatal.
    }
  }, [audioUrl]);

  // Reveal Claude's lyrics character-by-character during the music wait —
  // the lyrics already exist (Claude returns before Suno is even submitted),
  // so the reveal is purely a UX device to make the wait feel productive.
  // Resets when a fresh lyric arrives (regenerate) and snaps to full length
  // once the audio is ready, so the user isn't waiting for the animation.
  useEffect(() => {
    if (!lyrics) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the typewriter reveal when lyrics are cleared (regenerate); driven by the lyrics dependency
      setLyricRevealChars(0);
      return;
    }
    const total = lyrics.raw.length;
    if (audioUrl) {
      setLyricRevealChars(total);
      return;
    }
    setLyricRevealChars(0);
    const interval = setInterval(() => {
      setLyricRevealChars((prev) => {
        if (prev >= total) {
          clearInterval(interval);
          return total;
        }
        return prev + 1;
      });
    }, TYPEWRITER_MS_PER_CHAR);
    return () => clearInterval(interval);
  }, [lyrics, audioUrl]);

  // Auto-create the share artifact as soon as the song completes so the
  // promised email always fires — even if the user closes the tab without
  // clicking Share. Guarded so it fires exactly once per song.
  const autoShareTriggeredRef = useRef(false);
  useEffect(() => {
    if (!audioUrl || !lyrics) return;
    if (shareUrl || creatingShare || autoShareTriggeredRef.current) return;
    autoShareTriggeredRef.current = true;
    // eslint-disable-next-line react-hooks/immutability -- createShareLink is a hoisted function declaration; calling it before its lexical position is safe at runtime
    void createShareLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createShareLink is stable enough; intentional run-once
  }, [audioUrl, lyrics, shareUrl, creatingShare]);
  useEffect(() => {
    // Reset the guard when the user starts a new generation.
    if (!loadingLyrics && !loadingMusic) return;
    autoShareTriggeredRef.current = false;
  }, [loadingLyrics, loadingMusic]);

  // Force explicit re-affirmation when the path-dependent statement changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally clears the attestation when the minor/adult statement changes so it must be re-affirmed
    setAttested(false);
  }, [recipientIsMinor]);

  async function ensureCapture(): Promise<boolean> {
    setCaptureError(null);
    if (recipientAge === null) {
      setCaptureError("Tell us how old they're turning.");
      return false;
    }
    const ageStr = String(recipientAge);
    let captureDone = false;
    let storedAge: string | null = null;
    try {
      captureDone = sessionStorage.getItem(CAPTURE_DONE_KEY) === "1";
      storedAge = sessionStorage.getItem(CAPTURE_AGE_KEY);
    } catch {
      // sessionStorage unavailable; treat as fresh capture.
    }
    if (captureDone && storedAge === ageStr) return true;

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          target_age: recipientAge,
          is_adult: attested,
          parental_consent_given: recipientIsMinor ? attested : undefined,
          venue_slug: venue?.slug,
          // Phase 3: structured capture from the values the form already holds.
          // All optional server-side — sent only when present.
          recipient_name: name.trim() || undefined,
          language,
          genre: genre.trim() || undefined,
          relationship: relationship.trim() || undefined,
          // Reminder/marketing consent is suppressed entirely for minors; the
          // server independently forces it false on child-recipient flows.
          marketing_reminder_consent: recipientIsMinor ? false : marketingConsent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCaptureError(data?.error?.message ?? "Couldn't save. Please try again.");
        return false;
      }
      try {
        sessionStorage.setItem(CAPTURE_DONE_KEY, "1");
        sessionStorage.setItem(CAPTURE_AGE_KEY, ageStr);
        sessionStorage.setItem(CAPTURE_EMAIL_KEY, emailInput.trim().toLowerCase());
      } catch {
        // sessionStorage unavailable; carry on without persistence.
      }
      track("capture_complete", {
        venue_slug: venue?.slug ?? "none",
        is_minor: recipientIsMinor,
      });
      return true;
    } catch {
      setCaptureError("Couldn't reach the server. Please check your connection.");
      return false;
    }
  }

  const theme = themes[themeKey];
  const trimmedEmail = emailInput.trim();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  // Progressive commitment: the first free action (Write Lyrics) needs only the
  // minimum to personalize — name, age, and genre. Age stays here because it
  // drives the minor-consent branch (recipientIsMinor). Email + attestation are
  // deferred to the music step (the real payoff), so we never gate the first
  // taste of value behind five barriers.
  const missingForLyrics = !name.trim()
    ? t.generate.missingAddName
    : recipientAge === null
      ? t.generate.missingAge
      : !genre
        ? t.generate.missingGenre
        : null;
  const canGenerateLyrics = missingForLyrics === null;
  // The music step is the commitment point — this is where we require the email
  // (so delivery, auto-share, and abandoned-recovery enrollment all work) and
  // the age attestation / parental-consent box. Lyrics must already exist.
  const missingForMusic = !lyrics
    ? t.generate.missingWriteLyricsFirst
    : !trimmedEmail
      ? t.generate.missingAddEmail
      : !emailValid
        ? t.generate.missingEmailFormat
        : !attested
          ? recipientIsMinor
            ? t.generate.missingGuardian
            : t.generate.missingTickBox
          : null;
  const canGenerateMusic = missingForMusic === null;
  const musicLocked = loadingMusic || jobId !== null || audioUrl !== null;
  const audioProxyUrl = audioUrl ? toAudioProxyUrl(audioUrl) : null;

  // Sender recognition (Phase 1): the relationship answer is localized for
  // display and for the premiere's producer credit, but the value stored in
  // `relationship` state stays canonical so the lyric prompt sees the same
  // context it always has.
  const relationshipOptions = [
    { value: "Friend", label: t.generate.relationshipFriend },
    { value: "Partner", label: t.generate.relationshipPartner },
    { value: "Family", label: t.generate.relationshipFamily },
    { value: "Colleague", label: t.generate.relationshipColleague },
    { value: "Other", label: t.generate.relationshipOther },
  ] as const;
  const relationshipRole =
    relationshipOptions.find((o) => o.value === relationship)?.label ??
    relationship.trim();
  // Producer credit on the premiere — the sender's name and/or how they relate
  // to the star. Undefined when we have neither, so the credit line hides.
  const directorName =
    [senderName.trim(), relationship.trim() ? relationshipRole : ""]
      .filter(Boolean)
      .join(" · ") || undefined;

  // ── v4 beat engine ─────────────────────────────────────────────────────
  // One decision per screen. Each beat only sets an existing canonical state
  // field; the render below reads `beatIndex` to pick which beat to show.
  const BEAT_COUNT = 7;
  const starUpper = name.trim() ? name.trim().toUpperCase() : "";
  const monthNames = t.generate.months;
  // Director credit for the dossier: the localized relationship role, else the
  // sender's name, else a soft "you" — never touches the payload derivations.
  const dossierDirectedBy =
    (relationship.trim() ? relationshipRole : senderName.trim()) ||
    t.generate.dossierDirectedYou;
  const birthdayLabelText =
    birthMonth && birthDay
      ? `${monthNames[Number.parseInt(birthMonth, 10) - 1] ?? ""} ${birthDay}`
      : "";
  // Relationship-aware Milo line for the "moment" beat.
  const miloMomentLine =
    relationship === "Friend"
      ? t.generate.miloMomentFriend
      : relationship === "Partner"
        ? t.generate.miloMomentPartner
        : relationship === "Family"
          ? t.generate.miloMomentFamily
          : relationship === "Colleague"
            ? t.generate.miloMomentColleague
            : relationship === "Other"
              ? t.generate.miloMomentOther
              : t.generate.miloMoment;
  // Milo's little reaction to the typed moment (shown once there's real text).
  const memoryLower = memory.toLowerCase();
  const miloMomentReaction = !memory.trim()
    ? ""
    : /laugh|funny|joke|sing|danc/.test(memoryLower)
      ? t.generate.miloMomentReactFun
      : /kind|care|always|help|there|love/.test(memoryLower)
        ? t.generate.miloMomentReactKind
        : t.generate.miloMomentReactDefault;

  // Compute the next occurrence of a month/day as an ISO date (09:00 that day)
  // and store it in waitBirthdayDate. Runs only from the select change handler
  // (event handler — Date use here is allowed; never during render).
  function syncBirthday(monthStr: string, dayStr: string) {
    setBirthMonth(monthStr);
    setBirthDay(dayStr);
    const m = Number.parseInt(monthStr, 10);
    const d = Number.parseInt(dayStr, 10);
    if (!m || !d) {
      setWaitBirthdayDate("");
      return;
    }
    const now = new Date();
    let year = now.getFullYear();
    const todayMidnight = new Date(year, now.getMonth(), now.getDate());
    const candidate = new Date(year, m - 1, d);
    if (candidate < todayMidnight) year += 1;
    const iso = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    setWaitBirthdayDate(iso);
  }

  const birthdayBeatValid = !!birthMonth && !!birthDay && recipientAge !== null;
  // Per-beat validity gates the "Next" button. Beats 2 (moment) & 6 (birthday)
  // require input; the note beat is always skippable; chip beats auto-advance.
  function beatValid(i: number): boolean {
    switch (i) {
      case 0:
        return !!relationship;
      case 1:
        return memory.trim().length > 2;
      case 2:
        return true; // private note is optional
      case 3:
        return !!feeling;
      case 4:
        return !!genre;
      case 5:
        return true; // language always has a default
      case 6:
        return birthdayBeatValid;
      default:
        return true;
    }
  }
  function scrollToFlowTop() {
    if (typeof window === "undefined") return;
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Older browsers may reject the options object; ignore.
    }
  }
  function goToBeat(i: number) {
    setBeatIndex(Math.max(0, Math.min(BEAT_COUNT - 1, i)));
    scrollToFlowTop();
  }
  function advanceBeat() {
    if (beatIndex >= BEAT_COUNT - 1) {
      // Last beat finished → write the lyrics (studio takes over on step 2).
      void generateLyricsHandler();
      return;
    }
    goToBeat(beatIndex + 1);
  }

  // Guided 3-step flow — derived purely from existing state so it can never
  // desync from the actual render conditions (no parallel state machine):
  //   Step 1 "About them"  → no lyrics yet (the details form).
  //   Step 2 "Your lyrics" → lyrics exist but the song isn't ready (incl. the
  //                          music-rendering wait, which lives on step 2).
  //   Step 3 "The song"    → audio is ready (reveal + preview + paywall).
  const step: 1 | 2 | 3 = audioUrl ? 3 : lyrics ? 2 : 1;
  const stepLabels: [string, string, string] = [
    t.generate.stepDetails,
    t.generate.stepLyrics,
    t.generate.stepSong,
  ];

  // Smooth-scroll to the top of the flow whenever the step advances. SSR-guarded
  // and best-effort — never throws into the UI.
  const flowTopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      flowTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      // Older browsers may reject the options object; ignore.
    }
  }, [step]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    if (cleanupRef.current) cleanupRef.current();

    // runConfetti/runBalloons/runBubbles are hoisted function declarations; using
    // them before their lexical position is safe at runtime.
    // eslint-disable-next-line react-hooks/immutability -- hoisted function declaration, safe to reference before its lexical position
    if (theme.effect === "confetti") cleanupRef.current = runConfetti(canvas);
    // eslint-disable-next-line react-hooks/immutability -- hoisted function declaration, safe to reference before its lexical position
    else if (theme.effect === "balloons") cleanupRef.current = runBalloons(canvas);
    // eslint-disable-next-line react-hooks/immutability -- hoisted function declaration, safe to reference before its lexical position
    else if (theme.effect === "bubbles") cleanupRef.current = runBubbles(canvas);
    else cleanupRef.current = null;

    return () => {
      window.removeEventListener("resize", resize);
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [theme.effect]);

  useEffect(() => {
    if (!jobId) return;

    const startedAt = Date.now();
    let cancelled = false;
    let consecutiveFailures = 0;

    const tick = async () => {
      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed > GENERATION_TIMEOUT_MS) {
        setErrorMsg("Song generation took too long. Please try again.");
        setLoadingMusic(false);
        setJobId(null);
        return;
      }
      if (elapsed > LONG_WAIT_HINT_MS) {
        setLongWaitHint(true);
      }

      try {
        const res = await fetch(`/api/song-status?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as SongStatusResponse;
        consecutiveFailures = 0;

        if (data.status === "complete") {
          if (cancelled) return;
          track("song_ready", {
            venue_slug: venue?.slug ?? "none",
            duration_seconds: Math.round((Date.now() - startedAt) / 1000),
          });
          setAudioUrl(data.audioUrl);
          setProgress(100);
          setReady(true);
          setJobId(null);
          if (completeDelayRef.current) clearTimeout(completeDelayRef.current);
          completeDelayRef.current = setTimeout(() => {
            setLoadingMusic(false);
            completeDelayRef.current = null;
          }, 800);
          return;
        }
        if (data.status === "failed") {
          if (cancelled) return;
          track("song_failed", {
            venue_slug: venue?.slug ?? "none",
            reason: data.error || "unknown",
          });
          setErrorMsg(data.error || "Music service couldn't complete the song.");
          setLoadingMusic(false);
          setJobId(null);
          return;
        }

        if (typeof data.progress === "number") {
          setProgress(Math.min(90, Math.max(10, data.progress)));
        } else {
          setProgress((p) => Math.min(90, p + 5));
        }
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) {
          setErrorMsg("Connection lost while waiting for your song. Please try again.");
          setLoadingMusic(false);
          setJobId(null);
        }
      }
    };

    void tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  useEffect(() => {
    if (!loadingLyrics && !loadingMusic) return;
    const startedAt = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the elapsed timer to zero before the 1s interval takes over; part of the loading subscription
    setElapsedMs(0);
    const tick = () => setElapsedMs(Date.now() - startedAt);
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [loadingLyrics, loadingMusic]);

  async function generateLyricsHandler() {
    if (!canGenerateLyrics || loadingLyrics || loadingMusic) return;

    track("gen_lyrics_click", { venue_slug: venue?.slug ?? "none" });

    // Progressive commitment: lyrics don't require an email. If the user has
    // already entered a valid one, opportunistically capture it (fire-and-
    // forget — never block the lyrics on it); otherwise we defer capture to
    // the music step where email + consent are guaranteed present.
    if (emailValid) {
      void ensureCapture();
    }

    if (completeDelayRef.current) {
      clearTimeout(completeDelayRef.current);
      completeDelayRef.current = null;
    }

    setLoadingLyrics(true);
    setReady(false);
    setProgress(0);
    setErrorMsg(null);
    setAudioUrl(null);
    setLyrics(null);
    setEditableSections([]);
    setResolvedGenre(null);
    setJobId(null);
    setLongWaitHint(false);
    setElapsedMs(0);
    setShareUrl(null);
    setShareError(null);
    setCopied(false);

    const payload: GenerateSongRequest = {
      name: name.trim(),
      language,
      genre: genre as GenerateSongRequest["genre"],
      relationship: relationship.trim() || undefined,
      age: recipientAge !== null ? String(recipientAge) : undefined,
      profession: profession.trim() || undefined,
      memory: memory.trim() || undefined,
      extras: extras.trim() || undefined,
      pronunciation_hint: pronunciationHint.trim() || undefined,
      style_notes: styleNotes.trim() || undefined,
      feeling: feeling.trim() || undefined,
      director_credit:
        (relationship.trim() ? relationshipRole : senderName.trim()) || undefined,
    };

    try {
      const res = await fetch("/api/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error?.message ?? "Couldn't write lyrics. Please try again.");
        setLoadingLyrics(false);
        return;
      }
      const ok = data as GenerateLyricsResponse;
      try {
        track("lyrics_generated", {
          venue_slug: venue?.slug ?? "none",
          genre: ok.resolvedGenre ?? genre,
        });
      } catch {
        // Analytics is non-critical; swallow.
      }
      setLyrics(ok.lyrics);
      setEditableSections(
        ok.lyrics.sections.map((s) => ({ tag: s.tag, text: s.lines.join("\n") })),
      );
      setResolvedGenre(ok.resolvedGenre);
      setLoadingLyrics(false);
    } catch {
      setErrorMsg("Couldn't reach the server. Please check your connection and try again.");
      setLoadingLyrics(false);
    }
  }

  async function generateMusicHandler() {
    // The explicit `!lyrics` check also narrows `lyrics` to non-null for the
    // payload below; canGenerateMusic already requires it, but TS can't infer
    // that through the derived boolean.
    if (!lyrics || !canGenerateMusic || loadingLyrics || loadingMusic) return;

    track("gen_music_click", { venue_slug: venue?.slug ?? "none" });
    try {
      track("music_generate_click", { venue_slug: venue?.slug ?? "none" });
    } catch {
      // Analytics is non-critical; swallow.
    }

    // Commitment point — email + consent are guaranteed present here, so this
    // is where we capture them (drives delivery email + abandoned-recovery
    // enrollment downstream). Must succeed before submitting the music job.
    const captureOk = await ensureCapture();
    if (!captureOk) return;

    if (completeDelayRef.current) {
      clearTimeout(completeDelayRef.current);
      completeDelayRef.current = null;
    }

    setLoadingMusic(true);
    setReady(false);
    setProgress(0);
    setErrorMsg(null);
    setAudioUrl(null);
    setJobId(null);
    setLongWaitHint(false);
    setElapsedMs(0);
    setShareUrl(null);
    setShareError(null);
    setCopied(false);

    const editedSections = editableSections
      .map((s) => ({
        tag: s.tag,
        lines: s.text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0),
      }))
      .filter((s) => s.lines.length > 0);

    if (editedSections.length === 0) {
      setErrorMsg("Lyrics can't be empty. Please add at least one line.");
      setLoadingMusic(false);
      return;
    }

    const trimmedStyleNotes = styleNotes.trim();
    const trimmedPronunciationHint = pronunciationHint.trim();
    const payload: GenerateMusicRequest = {
      lyrics: { ...lyrics, sections: editedSections },
      name: name.trim(),
      genre: resolvedGenre ?? genre,
      language,
      ...(trimmedStyleNotes ? { style_notes: trimmedStyleNotes } : {}),
      // Suno-side: substituted into the lyric copy server-side. Display
      // lyrics keep the original spelling.
      ...(trimmedPronunciationHint ? { pronunciation_hint: trimmedPronunciationHint } : {}),
    };

    try {
      const res = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error?.message ?? "Couldn't start music generation. Please try again.");
        setLoadingMusic(false);
        return;
      }
      const ok = data as GenerateMusicResponse;
      setJobId(ok.jobId);
      if (ok.refinedStyle) setRefinedStyle(ok.refinedStyle);
      setProgress(10);
    } catch {
      setErrorMsg("Couldn't reach the server. Please check your connection and try again.");
      setLoadingMusic(false);
    }
  }

  function resetForRetry() {
    setErrorMsg(null);
    setLoadingLyrics(false);
    setLoadingMusic(false);
    setJobId(null);
    setLongWaitHint(false);
    setProgress(0);
  }

  function buildLyricsFromEditable(): Lyrics | null {
    if (!lyrics) return null;
    const sections = editableSections
      .map((s) => ({
        tag: s.tag,
        lines: s.text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0),
      }))
      .filter((s) => s.lines.length > 0);
    if (sections.length === 0) return null;
    return { ...lyrics, sections };
  }

  async function createShareLink() {
    if (!lyrics || !audioUrl || creatingShare) return;
    const editedLyrics = buildLyricsFromEditable();
    if (!editedLyrics) {
      setShareError("Lyrics can't be empty.");
      return;
    }

    setCreatingShare(true);
    setShareError(null);
    setShareUrl(null);
    setCopied(false);

    const trimmedSender = senderName.trim();
    let storedEmail: string | null = null;
    try {
      storedEmail = sessionStorage.getItem(CAPTURE_EMAIL_KEY);
    } catch {
      // sessionStorage unavailable; fall back to in-memory form state.
    }
    const emailToSend = (storedEmail || emailInput).trim().toLowerCase();
    const trimmedStyleNotesForShare = styleNotes.trim();
    // The "Produced & directed by" credit shown in the premiere titles — the
    // relationship role when one was picked, otherwise the sender's own name.
    const directorCredit = relationship.trim() ? relationshipRole : trimmedSender;
    const trimmedNoteText = directorNoteText.trim();

    // Collect the wait-state capture into a single object — skip the field
    // when blank so we never persist empty-string entries to KV. The whole
    // object is omitted when nothing was filled in, keeping the share row
    // clean for users who skipped the capture entirely.
    const waitCapture: WaitCapture = {
      ...(waitRelationship ? { relationship: waitRelationship } : {}),
      ...(waitLocation ? { celebration_location: waitLocation } : {}),
      ...(waitYearReminder ? { year_reminder: true } : {}),
    };
    const waitCaptureHasValue = Object.keys(waitCapture).length > 0;
    if (waitCaptureHasValue) {
      track("wait_capture_completed", {
        venue_slug: venue?.slug ?? "none",
        relationship: waitRelationship || "none",
        celebration_location: waitLocation || "none",
        year_reminder: waitYearReminder,
      });
    }

    const payload: ShareCreateRequest = {
      name: name.trim(),
      language,
      genre: resolvedGenre ?? genre,
      lyrics: editedLyrics,
      audioUrl,
      template: shareTemplate,
      ...(trimmedSender ? { senderName: trimmedSender } : {}),
      ...(trimmedStyleNotesForShare ? { style_notes: trimmedStyleNotesForShare } : {}),
      ...(refinedStyle ? { refined_style: refinedStyle } : {}),
      // Forwarded so regenerate can re-apply the substitution on retries
      // without re-prompting the user. Never persisted into displayed lyrics.
      ...(pronunciationHint.trim()
        ? { pronunciation_hint: pronunciationHint.trim() }
        : {}),
      ...(waitCaptureHasValue ? { wait_capture: waitCapture } : {}),
      ...(waitBirthdayDate.trim() ? { birthday_date: waitBirthdayDate.trim() } : {}),
      // Only send delivery when we have both a birthday and the giver's tz; the
      // server falls back to instant reveal otherwise.
      ...(waitBirthdayDate.trim() && browserTz
        ? { delivery: { mode: deliveryMode, timezone: browserTz } }
        : {}),
      ...(cakeStyle ? { cake_style: cakeStyle } : {}),
      ...(candleColor ? { candle_color: candleColor } : {}),
      ...(personalNote.trim() ? { personal_note: personalNote.trim() } : {}),
      ...(directorCredit ? { director_credit: directorCredit } : {}),
      ...(feeling.trim() ? { feeling: feeling.trim() } : {}),
      ...(trimmedNoteText ? { director_note_text: trimmedNoteText } : {}),
      ...(directorNoteVoiceUrl ? { director_note_voice_url: directorNoteVoiceUrl } : {}),
      ...(directorNoteVoiceDurationSec != null
        ? { director_note_voice_duration_sec: directorNoteVoiceDurationSec }
        : {}),
      ...(photoUrls.length > 0 ? { photoUrls } : {}),
      ...(venue ? { venueSlug: venue.slug } : {}),
      ...(emailToSend ? { email: emailToSend } : {}),
    };

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setShareError(data?.error?.message ?? "Couldn't create share link.");
        return;
      }
      const ok = data as ShareCreateResponse;
      const absolute = typeof window !== "undefined"
        ? new URL(ok.shareUrl, window.location.origin).toString()
        : ok.shareUrl;
      setShareUrl(absolute);
      if (ok.tier === "A" || ok.tier === "B" || ok.tier === "C") setShareTier(ok.tier);
      setPremiereDeliverAt(ok.deliverAt ?? null);
      setPremierePreviewUrl(
        ok.previewUrl && typeof window !== "undefined"
          ? new URL(ok.previewUrl, window.location.origin).toString()
          : ok.previewUrl ?? null,
      );
    } catch {
      setShareError("Couldn't reach the server. Please try again.");
    } finally {
      setCreatingShare(false);
    }
  }

  // Open one-time Stripe checkout to unlock the full song. shareId is the tail
  // of the auto-created share URL; the button stays disabled until it exists.
  async function unlockFullSong() {
    const shareId = shareUrl ? shareUrl.split("/").pop() ?? null : null;
    if (!shareId || unlocking) return;
    // Production bundles the AI call — don't open checkout until its details are
    // complete (character + phone + consent). The server validates again.
    if (unlockPlan === "production" && !isProductionCallReady(callSetup)) return;
    setUnlocking(true);
    setShareError(null);
    try {
      track("unlock_click", { share_id: shareId, tier: shareTier ?? "unknown", plan: unlockPlan });
      const callBody =
        unlockPlan === "production"
          ? {
              consent: callSetup.consent,
              consentText: consentAttestationText(name, locale),
              call: {
                characterId: callSetup.characterId,
                phone: callSetup.phone.trim(),
                scheduledAt: callSetup.date
                  ? new Date(`${callSetup.date}T10:00`).toISOString()
                  : undefined,
              },
            }
          : {};
      const res = await fetch("/api/stripe/checkout-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, plan: unlockPlan, ...callBody }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }
      setShareError(data?.error?.message ?? "Couldn't start checkout. Please try again.");
    } catch {
      setShareError("Couldn't reach the server. Please try again.");
    } finally {
      setUnlocking(false);
    }
  }

  // Optional slideshow photos — upload selected images to R2 and stash the
  // returned URLs so createShareLink() can persist them on the share. Fully
  // non-blocking: errors surface inline and never stop the user from sharing.
  async function handlePhotoSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    const remaining = MAX_SLIDESHOW_PHOTOS - photoUrls.length;
    if (remaining <= 0) {
      setPhotoError(`You can add up to ${MAX_SLIDESHOW_PHOTOS} photos.`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    const form = new FormData();
    for (const file of selected) form.append("photos", file);

    setUploadingPhotos(true);
    track("slideshow_photos_upload_start", {
      venue_slug: venue?.slug ?? "none",
      count: selected.length,
    });
    try {
      const res = await fetch("/api/photos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data?.error?.message ?? "Couldn't upload photos.");
        return;
      }
      const urls = Array.isArray(data?.urls) ? (data.urls as string[]) : [];
      if (urls.length === 0) {
        setPhotoError("No photos were uploaded.");
        return;
      }
      setPhotoUrls((prev) => [...prev, ...urls].slice(0, MAX_SLIDESHOW_PHOTOS));
      // The photo slideshow is a Deluxe-only feature — the render route rejects
      // Standard purchases (see app/api/slideshow/render). So if a Standard
      // buyer adds photos, move them to Deluxe: the CTA + charge then match what
      // they'll actually receive, instead of a dead-end after paying.
      setUnlockPlan((plan) => (plan === "full" ? "deluxe" : plan));
      track("slideshow_photos_uploaded", {
        venue_slug: venue?.slug ?? "none",
        count: urls.length,
      });
    } catch {
      setPhotoError("Couldn't reach the server. Please try again.");
    } finally {
      setUploadingPhotos(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShareError("Couldn't copy to clipboard. Please copy the link manually.");
    }
  }

  // ── Crowd-magic handlers ────────────────────────────────────────────────
  // Mint a group-song gift from the recipient name already in state, then show
  // the /join link. Optional and non-blocking: it never gates the solo flow.
  async function createGroupSong() {
    if (crowdCreating || crowdJoinUrl) return;
    const recipientName = name.trim();
    if (!recipientName) return;
    setCrowdError(null);
    setCrowdCreating(true);
    try {
      const res = await fetch("/api/crowd/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          language,
          genre: (resolvedGenre ?? genre).trim() || undefined,
          directorName: senderName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { joinUrl?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.joinUrl) {
        setCrowdError(data?.error?.message ?? t.crowd.error);
        return;
      }
      const absolute =
        typeof window !== "undefined"
          ? new URL(data.joinUrl, window.location.origin).toString()
          : data.joinUrl;
      setCrowdJoinUrl(absolute);
      try {
        track("crowd_create", { venue_slug: venue?.slug ?? "none" });
      } catch {
        // Analytics is non-critical; swallow.
      }
    } catch {
      setCrowdError(t.crowd.error);
    } finally {
      setCrowdCreating(false);
    }
  }

  async function copyCrowdLink() {
    if (!crowdJoinUrl) return;
    try {
      await navigator.clipboard.writeText(crowdJoinUrl);
      setCrowdCopied(true);
      setTimeout(() => setCrowdCopied(false), 1500);
    } catch {
      // Non-critical — the link sits in a selectable read-only field beside it.
    }
  }

  async function shareCrowdLink() {
    if (!crowdJoinUrl) return;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Happy Birthday, ${name.trim()}!`,
          url: crowdJoinUrl,
        });
        return;
      } catch {
        // User dismissed or sharing failed; fall through to copy.
      }
    }
    await copyCrowdLink();
  }

  // Optional promo-use permission. Fire-and-forget — failure must never affect
  // the share UI. The server also forces granted=false for minor recipients.
  function submitPromoPermission(granted: boolean) {
    setPromoGranted(granted);
    setPromoResponded(true);
    setPromoSaved(false);
    try {
      void fetch("/api/promo-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          granted,
          email: emailInput.trim() || undefined,
          anonymous_id: getAnonId(),
          share_id: shareUrl ? shareUrl.split("/").pop() : undefined,
          recipient_name: name.trim() || undefined,
          is_minor_recipient: recipientIsMinor,
        }),
      })
        .then((res) => {
          if (res.ok) setPromoSaved(true);
        })
        .catch(() => {});
    } catch {
      // Never throw into the UI.
    }
  }

  async function openShareUi() {
    if (!shareUrl) return;
    track("share_click", { venue_slug: venue?.slug ?? "none" });
    // Durable first-party audit event (independent of analytics consent).
    logClientEvent("share_click", {
      share_id: shareUrl.split("/").pop() ?? null,
      venue_slug: venue?.slug ?? null,
      recipient_name: name.trim() || null,
      language,
      genre: genre.trim() || null,
    });
    const text = senderName.trim()
      ? `${senderName.trim()} made you a birthday song \u{1F382}`
      : `A birthday song for ${name.trim() || "you"} \u{1F382}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Happy Birthday, ${name.trim()}!`,
          text,
          url: shareUrl,
        });
        return;
      } catch {
        // User dismissed or sharing failed; fall through to copy.
      }
    }
    await copyShareUrl();
  }

  function runConfetti(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const colors = ["#f43f5e", "#a855f7", "#3b82f6", "#facc15", "#34d399", "#fb923c"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      speed: Math.random() * 1.4 + 0.6,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.y += p.speed;
        p.rotation += 0.03;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }

  function runBalloons(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const colors = ["#f43f5e", "#a855f7", "#3b82f6", "#facc15", "#fb923c"];
    const balloons = Array.from({ length: 20 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * canvas.height,
      r: Math.random() * 26 + 18,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 0.7 + 0.3,
      sway: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      balloons.forEach((b) => {
        b.sway += 0.015;
        b.y -= b.speed;
        b.x += Math.sin(b.sway) * 0.5;
        if (b.y < -100) {
          b.y = canvas.height + 100;
          b.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * 0.8, b.r, 0, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.r);
        ctx.bezierCurveTo(b.x + 8, b.y + b.r + 25, b.x - 8, b.y + b.r + 45, b.x, b.y + b.r + 65);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.stroke();
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }

  function runBubbles(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const bubbles = Array.from({ length: 36 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * canvas.height,
      r: Math.random() * 28 + 10,
      speed: Math.random() * 0.6 + 0.2,
      sway: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bubbles.forEach((b) => {
        b.sway += 0.012;
        b.y -= b.speed;
        b.x += Math.sin(b.sway) * 0.4;
        if (b.y < -70) {
          b.y = canvas.height + 70;
          b.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }

  return (
    <main
      className={`gen-stage grain relative min-h-screen overflow-x-hidden bg-cream ${theme.text} px-4 py-6 sm:py-8 transition-all duration-700`}
    >
      <style>{`
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        /* ── Theatrical "noir stage" repaint — scoped to the intake only.
           Overriding the @theme CSS vars on this subtree flips every
           bg-cream / text-ink / border-sand / text-gold to the premiere's
           dark palette without touching any other route (share/join/etc.). */
        .gen-stage {
          --color-cream: #120a1e;
          --color-cream-soft: rgba(255,255,255,0.055);
          --color-sand: rgba(255,255,255,0.13);
          --color-ink: #f4e9ff;
          --color-ink-soft: #c9b8e6;
          --color-gold: #ffcf6b;
          --color-jade: #4be3b0;
          --color-blush: #ff6fae;
          --warm-gradient: linear-gradient(120deg,#ffb03a 0%,#ff6fae 55%,#ff3d90 100%);
          --warm-gradient-soft: linear-gradient(120deg,rgba(255,207,107,0.16),rgba(255,111,174,0.16));
          background: radial-gradient(1200px 720px at 50% -12%, #3a1f5e 0%, #1c1030 46%, #120a1e 100%) fixed;
        }
        .gen-stage input, .gen-stage textarea { background: rgba(0,0,0,0.26); }
        .gen-stage ::placeholder { color: #a596c4; opacity: 1; }
        .gen-stage .grain { color: #f4e9ff; }
        @keyframes floatOne {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(-32px) rotate(8deg) scale(1.08); }
        }
        @keyframes floatTwo {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(28px) rotate(-10deg) scale(1.05); }
        }
        @keyframes bgMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .moving-bg {
          background-size: 350% 350%;
          animation: bgMove 16s ease infinite;
        }
        .float-one { animation: floatOne 9s ease-in-out infinite; }
        .float-two { animation: floatTwo 12s ease-in-out infinite; }

        /* ── v4 beat-engine chrome: marquee, reel, dossier, chips ── */
        .gen-stage .marquee-sign {
          position: relative; border-radius: 16px; padding: 22px 18px; text-align: center;
          background: rgba(0,0,0,.30); border: 2px solid rgba(255,207,107,.45);
          box-shadow: 0 0 46px -10px rgba(255,180,90,.45), inset 0 0 34px rgba(255,180,90,.09);
        }
        .gen-stage .marquee-sign::before, .gen-stage .marquee-sign::after {
          content: ""; position: absolute; left: 10px; right: 10px; height: 7px;
          background-image: radial-gradient(circle, #ffde8f 0 2.6px, transparent 3px);
          background-size: 16px 7px; background-repeat: repeat-x; opacity: .9;
          filter: drop-shadow(0 0 3px rgba(255,207,107,.9));
        }
        .gen-stage .marquee-sign::before { top: 6px; }
        .gen-stage .marquee-sign::after { bottom: 6px; }
        .gen-stage .m-name {
          font-weight: 900; letter-spacing: .06em; font-size: 32px; line-height: 1.05;
          text-transform: uppercase; color: #fff; word-break: break-word; min-height: 34px;
          text-shadow: 0 0 12px rgba(255,207,107,.85), 0 0 30px rgba(255,111,174,.55);
        }
        .gen-stage .m-name.empty { color: #5a4a78; text-shadow: none; }
        .gen-stage .reel { display: flex; gap: 6px; justify-content: center; }
        .gen-stage .reel i {
          height: 4px; width: 20px; border-radius: 3px;
          background: rgba(255,255,255,.14); transition: .3s;
        }
        .gen-stage .reel i.on { background: linear-gradient(120deg,#ffcf6b,#ff6fae); }
        .gen-stage .dossier li { opacity: .34; transition: .35s; }
        .gen-stage .dossier li.on { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .gen-stage .animate-eq { animation: none !important; }
        }
      `}</style>

      {/* Warm organic blobs bleeding off the edges (matches the landing look). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -top-56 z-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,207,107,0.28),transparent_62%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-24 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,111,174,0.30),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-40 z-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(123,63,158,0.35),transparent_66%)] blur-2xl"
      />

      <canvas ref={canvasRef} className="fixed inset-0 z-[1] pointer-events-none select-none" />

      {/* Light/dark switch — floats top-right above the centered header. */}
      <div className="absolute right-4 top-6 z-30 sm:right-6">
        <ThemeToggle />
      </div>

      {venue && (
        <div
          className="relative z-20 mx-auto mb-4 flex max-w-5xl items-center gap-2 rounded-r-xl border-l-2 bg-cream-soft px-4 py-2 text-sm font-semibold text-ink shadow-sm"
          style={{ borderLeftColor: venue.logo_color }}
        >
          <span>Birthday songs at</span>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: venue.logo_color }}
            aria-hidden
          />
          <span style={{ color: venue.logo_color }}>{venue.name}</span>
        </div>
      )}

      <header className="relative z-20 mx-auto mb-6 max-w-5xl text-center">
        <Image
          src="/brand/logo-mark-tight.png"
          alt="Sing My Birthday"
          width={104}
          height={104}
          priority
          className="mx-auto mb-4 h-[104px] w-[104px] drop-shadow-sm"
        />
        <div className="mb-3 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-warm-soft px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-gold shadow-sm sm:text-sm">
            {t.generate.studioBadge}
          </div>
        </div>

        <h1
          className={`bg-gradient-to-r ${theme.title} bg-clip-text pb-3 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-transparent sm:text-4xl lg:text-5xl`}
        >
          {t.generate.studioHook.replace(
            "{name}",
            name.trim() || t.generate.studioHookThem,
          )}
        </h1>

        <p className={`text-base sm:text-lg ${theme.sub}`}>
          {t.generate.studioHookSub}
        </p>
      </header>

      {/* Scroll anchor — the step-change effect scrolls this into view so each
          new step lands at the top of the flow. */}
      <div ref={flowTopRef} className="relative z-20 mx-auto max-w-xl scroll-mt-4" />

      {/* Guided-flow progress header — three labeled segments, current step in
          the brand gradient, completed steps marked done. Purely presentational;
          `step` is derived from existing state (see above), so this never gates
          or drives any logic. */}
      <nav
        aria-label="Progress"
        className="relative z-20 mx-auto mb-6 max-w-xl px-1"
      >
        <ol className="flex items-center gap-2 sm:gap-3">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const isCurrent = step === n;
            const isDone = step > n;
            return (
              <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
                <div
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2 transition ${
                    isCurrent
                      ? "border-transparent bg-warm-gradient text-white shadow-md"
                      : isDone
                        ? "border-jade/40 bg-warm-soft text-jade"
                        : "border-sand bg-cream-soft text-ink-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      isCurrent
                        ? "bg-white/25 text-white"
                        : isDone
                          ? "bg-jade/20 text-jade"
                          : "bg-sand text-ink-soft"
                    }`}
                  >
                    {isDone ? "✓" : n}
                  </span>
                  <span className="truncate text-xs font-bold">
                    {label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── STEP 1 · the intake: opening marquee, then the beat engine ── */}
      {step === 1 && (
        <section className={`relative z-10 mx-auto max-w-xl rounded-[2rem] border ${theme.card} p-5 shadow-sm sm:p-8`}>
          {intakeStage === "opening" ? (
            <>
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-warm-soft px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                {t.generate.openingBadge}
              </span>
              <p className="mb-4 text-sm leading-relaxed text-ink-soft">{t.generate.openingLead}</p>

              {/* The marquee — the star's name lights up as you type it. */}
              <div className="marquee-sign">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.28em] text-gold">
                  {t.generate.marqueeNowCasting}
                </div>
                <div className={`m-name my-2 ${starUpper ? "" : "empty"}`}>
                  {starUpper || t.generate.marqueeYourStar}
                </div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-soft">
                  {t.generate.marqueeBottom}
                </div>
              </div>

              <div className="mt-5">
                <ProducerBubble emoji="🎩">
                  {name.trim()
                    ? t.generate.miloOpeningNamed.replace("{name}", name.trim())
                    : t.generate.miloOpeningEmpty.replace("{producer}", t.generate.producerName)}
                </ProducerBubble>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="recipient-name" className="mb-2 block font-display text-lg font-bold text-ink">
                    {t.generate.nameLabel}
                  </label>
                  <input
                    id="recipient-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && name.trim()) {
                        e.preventDefault();
                        setIntakeStage("beats");
                      }
                    }}
                    placeholder={t.generate.namePlaceholder}
                    className={`w-full rounded-xl border px-4 py-4 text-lg text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                  />
                </div>

                <div>
                  <label htmlFor="pronunciation-hint" className="mb-2 block text-sm font-bold text-ink">
                    {t.generate.pronLabel} <span className="opacity-60">{t.generate.pronOptional}</span>
                  </label>
                  <input
                    id="pronunciation-hint"
                    value={pronunciationHint}
                    onChange={(e) => setPronunciationHint(e.target.value.slice(0, 80))}
                    placeholder={t.generate.pronPlaceholder}
                    maxLength={80}
                    className={`w-full rounded-xl border px-4 py-3.5 text-base text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                  />
                  <div className="mt-3">
                    {micState === "warming" ? (
                      <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-warm-soft px-4 py-3 text-sm font-bold text-ink">
                        <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
                        <span>…</span>
                      </div>
                    ) : micState === "recording" ? (
                      <button
                        type="button"
                        onClick={stopMicRecording}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-blush/50 bg-warm-soft px-4 py-3 text-sm font-bold text-ink transition hover:border-blush"
                      >
                        <span aria-hidden className="flex h-5 items-end gap-[3px]">
                          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                            <span
                              key={i}
                              className="block h-full w-[3px] rounded bg-blush animate-pulse-bar"
                              style={{ animationDelay: `${i * 0.08}s` }}
                            />
                          ))}
                        </span>
                        <span>⏹</span>
                      </button>
                    ) : micState === "transcribing" ? (
                      <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sand bg-cream px-4 py-3 text-sm font-bold text-ink-soft">
                        ✨
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startMicRecording}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sand bg-cream px-4 py-3 text-sm font-bold text-ink transition hover:border-jade"
                      >
                        <span aria-hidden>🎤</span> {t.generate.pronLabel}
                      </button>
                    )}
                    {micError && <p role="alert" className="mt-2 text-xs text-blush">{micError}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="sender-name" className="mb-2 block text-sm font-bold text-ink">
                    {t.generate.senderNameLabel}{" "}
                    <span className="opacity-60">{t.generate.senderNameOptional}</span>
                  </label>
                  <input
                    id="sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value.slice(0, 50))}
                    placeholder={t.generate.senderNamePlaceholder}
                    maxLength={50}
                    className={`w-full rounded-xl border px-4 py-3.5 text-base text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIntakeStage("beats")}
                disabled={!name.trim()}
                className="mt-6 w-full min-h-[44px] rounded-full bg-warm-gradient py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,80,150,0.6)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sand disabled:bg-none disabled:text-ink-soft disabled:shadow-none disabled:hover:translate-y-0 sm:text-lg"
              >
                {t.generate.startProduction}
              </button>
              {!name.trim() && (
                <p className="mt-2 text-center text-xs text-ink-soft">{t.generate.startProductionHint}</p>
              )}
            </>
          ) : (
            <>
              {/* Reel progress */}
              <div className="reel mb-4">
                {Array.from({ length: BEAT_COUNT }).map((_, i) => (
                  <i key={i} className={i <= beatIndex ? "on" : ""} />
                ))}
              </div>

              <StudioKicker>
                {[
                  t.generate.actCredit,
                  t.generate.actMoment,
                  t.generate.actNote,
                  t.generate.actFeelingBeat,
                  t.generate.actScore,
                  t.generate.actLanguage,
                  t.generate.actBirthday,
                ][beatIndex]}
              </StudioKicker>

              <ProducerBubble emoji={["🎬", "🎩", "💌", "🎭", "🎼", "🌍", "📅"][beatIndex]}>
                {[
                  t.generate.miloCredit,
                  miloMomentLine,
                  t.generate.miloNote,
                  t.generate.miloFeeling,
                  t.generate.miloScore,
                  t.generate.miloLanguage,
                  t.generate.miloBirthday,
                ][beatIndex]}
              </ProducerBubble>

              {/* The single beat card */}
              <div className="rounded-[1.25rem] border border-sand bg-cream-soft p-5">
                {/* Beat 0 — the credit (relationship) */}
                {beatIndex === 0 && (
                  <>
                    <label className="mb-2 block text-sm font-bold text-ink">{t.generate.relationshipLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {relationshipOptions.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setRelationship(value);
                            goToBeat(1);
                          }}
                          className={`rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 ${
                            relationship === value
                              ? "border-transparent bg-warm-gradient text-white shadow-md"
                              : "border-sand bg-cream text-ink hover:border-blush"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-ink-soft">{t.generate.relationshipHint}</p>
                  </>
                )}

                {/* Beat 1 — the moment (memory) */}
                {beatIndex === 1 && (
                  <>
                    <label htmlFor="moment" className="mb-2 block text-sm font-bold text-ink">
                      {t.generate.momentLabel}
                    </label>
                    <textarea
                      id="moment"
                      value={memory}
                      onChange={(e) => setMemory(e.target.value)}
                      rows={3}
                      placeholder={t.generate.momentPlaceholder}
                      className={`w-full resize-none rounded-xl border px-4 py-3.5 text-sm text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                    />
                    <button
                      type="button"
                      onClick={() => setMemory(t.generate.momentPlaceholder)}
                      className="mt-2 text-xs text-ink-soft"
                    >
                      {t.generate.sparkPrefix}
                      <span className="text-blush underline">{t.generate.sparkLink}</span>
                    </button>
                    {miloMomentReaction && (
                      <p className="mt-3 text-xs font-semibold text-jade">{miloMomentReaction}</p>
                    )}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setMoreOpen((v) => !v)}
                        aria-expanded={moreOpen}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-sand bg-cream px-4 py-3 text-sm font-bold text-ink-soft transition hover:text-ink"
                      >
                        {moreOpen ? t.generate.moreDetailsClose : t.generate.moreDetailsOpen}
                      </button>
                      {moreOpen && (
                        <div className="mt-4 space-y-3">
                          <input
                            value={profession}
                            onChange={(e) => setProfession(e.target.value)}
                            placeholder={t.generate.professionPlaceholder}
                            className={`w-full rounded-xl border px-4 py-3.5 text-sm text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                          />
                          <input
                            value={styleNotes}
                            onChange={(e) => setStyleNotes(e.target.value.slice(0, 2000))}
                            placeholder={t.generate.styleNotesPlaceholder}
                            maxLength={2000}
                            className={`w-full rounded-xl border px-4 py-3.5 text-sm text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                          />
                          <textarea
                            value={extras}
                            onChange={(e) => setExtras(e.target.value)}
                            placeholder={t.generate.extrasPlaceholder}
                            rows={2}
                            className={`w-full resize-none rounded-xl border px-4 py-3.5 text-sm text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Beat 2 — the private note (text or voice) */}
                {beatIndex === 2 && (
                  <>
                    <div className="mb-3 inline-flex rounded-full border border-sand bg-cream p-1">
                      <button
                        type="button"
                        onClick={() => setNoteMode("text")}
                        aria-pressed={noteMode === "text"}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                          noteMode === "text" ? "bg-warm-gradient text-white shadow" : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        {t.generate.noteTabText}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteMode("voice")}
                        aria-pressed={noteMode === "voice"}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                          noteMode === "voice" ? "bg-warm-gradient text-white shadow" : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        {t.generate.noteTabVoice}
                      </button>
                    </div>
                    {noteMode === "text" ? (
                      <textarea
                        value={directorNoteText}
                        onChange={(e) => setDirectorNoteText(e.target.value.slice(0, 280))}
                        placeholder={t.generate.notePlaceholder}
                        rows={3}
                        maxLength={280}
                        className={`w-full resize-none rounded-xl border px-4 py-3.5 text-sm text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                      />
                    ) : (
                      <div>
                        {directorNoteVoiceUrl ? (
                          <div className="flex items-center gap-3">
                            <audio src={directorNoteVoiceUrl} controls className="h-10 w-full max-w-xs" />
                            <button
                              type="button"
                              onClick={clearNoteVoice}
                              className="shrink-0 rounded-full border border-sand bg-cream px-3 py-2 text-xs font-bold text-ink-soft transition hover:text-ink"
                            >
                              {t.generate.noteReRecord}
                            </button>
                          </div>
                        ) : noteUploading ? (
                          <p className="text-sm text-ink-soft">{t.generate.noteUploadingLabel}</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => (noteRecording ? stopNoteRecording() : startNoteRecording())}
                            className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold text-white transition ${
                              noteRecording ? "bg-blush" : "bg-jade hover:bg-jade-deep"
                            }`}
                          >
                            {noteRecording ? t.generate.noteStopCta : t.generate.noteRecordCta}
                          </button>
                        )}
                        {noteRecording && <p className="mt-2 text-xs text-ink-soft">{t.generate.noteRecordingLabel}</p>}
                      </div>
                    )}
                    {directorNoteVoiceUrl && directorNoteVoiceDurationSec != null && (
                      <p className="mt-2 text-xs text-jade">
                        {t.generate.noteVoiceReady.replace("{seconds}", String(directorNoteVoiceDurationSec))}
                      </p>
                    )}
                    {noteError && <p className="mt-2 text-xs text-blush">{noteError}</p>}
                    <p className="mt-3 text-xs text-ink-soft">{t.generate.noteBeatFootnote}</p>
                  </>
                )}

                {/* Beat 3 — the feeling */}
                {beatIndex === 3 && (
                  <>
                    <label className="mb-2 block text-sm font-bold text-ink">{t.generate.feelingLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {feelingOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFeeling(opt.value);
                            goToBeat(4);
                          }}
                          className={`rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 ${
                            feeling === opt.value
                              ? "border-transparent bg-warm-gradient text-white shadow-md"
                              : "border-sand bg-cream text-ink hover:border-blush"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Beat 4 — the score (genre) */}
                {beatIndex === 4 && (
                  <>
                    <label className="mb-2 block text-sm font-bold text-ink">{t.generate.scoreLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {genres.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setGenre(item);
                            goToBeat(5);
                          }}
                          className={`rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 ${
                            genre === item
                              ? "border-transparent bg-warm-gradient text-white shadow-md"
                              : "border-sand bg-cream text-ink hover:border-blush"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setGenre("🎲 Surprise Me");
                          goToBeat(5);
                        }}
                        className={`rounded-full border border-dashed px-4 py-2.5 text-sm font-extrabold transition hover:-translate-y-0.5 ${
                          genre === "🎲 Surprise Me"
                            ? "border-transparent bg-warm-gradient text-white shadow-md"
                            : "border-tan bg-cream text-ink hover:border-blush"
                        }`}
                      >
                        {t.generate.scoreSurprise}
                      </button>
                    </div>
                  </>
                )}

                {/* Beat 5 — the language */}
                {beatIndex === 5 && (
                  <>
                    <label className="mb-2 block text-sm font-bold text-ink">{t.generate.languageSing}</label>
                    <div className="flex flex-wrap gap-2">
                      {languages.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            setLanguage(lang as Language);
                            goToBeat(6);
                          }}
                          className={`rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 ${
                            language === lang
                              ? "border-transparent bg-warm-gradient text-white shadow-md"
                              : "border-sand bg-cream text-ink hover:border-blush"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Beat 6 — the birthday (month + day + optional age) */}
                {beatIndex === 6 && (
                  <>
                    <label className="mb-2 block text-sm font-bold text-ink">
                      {t.generate.birthdayLabel}{" "}
                      <span className="opacity-60">{t.generate.birthdayOptional}</span>
                    </label>
                    <div className="flex gap-2.5">
                      <select
                        value={birthMonth}
                        onChange={(e) => syncBirthday(e.target.value, birthDay)}
                        className={`flex-[1.4] rounded-xl border px-4 py-3.5 text-base text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                      >
                        <option value="" disabled>
                          {t.generate.monthPlaceholder}
                        </option>
                        {monthNames.map((m, i) => (
                          <option key={m} value={String(i + 1)}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={birthDay}
                        onChange={(e) => syncBirthday(birthMonth, e.target.value)}
                        className={`flex-1 rounded-xl border px-4 py-3.5 text-base text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                      >
                        <option value="" disabled>
                          {t.generate.dayPlaceholder}
                        </option>
                        {Array.from({ length: 31 }).map((_, i) => (
                          <option key={i + 1} value={String(i + 1)}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-4">
                      <label htmlFor="recipient-age" className="mb-2 block text-sm font-bold text-ink">
                        {t.generate.ageBeatLabel}{" "}
                        <span className="opacity-60">({t.generate.ageBeatHint})</span>
                      </label>
                      <input
                        id="recipient-age"
                        type="number"
                        inputMode="numeric"
                        min={MIN_AGE}
                        max={MAX_AGE}
                        value={ageInput}
                        onChange={(e) => setAgeInput(e.target.value)}
                        placeholder={t.generate.agePlaceholder}
                        className={`w-full rounded-xl border px-4 py-3.5 text-base text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[1, 18, 21, 30, 40, 50, 60].map((milestone) => (
                          <button
                            key={milestone}
                            type="button"
                            onClick={() => setAgeInput(String(milestone))}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              ageInput === String(milestone)
                                ? "border-transparent bg-warm-gradient text-white shadow-md"
                                : "border-sand bg-cream text-ink hover:border-blush"
                            }`}
                          >
                            {milestone}
                          </button>
                        ))}
                      </div>
                    </div>
                    {birthMonth && birthDay && recipientAge === null && (
                      <p className="mt-3 text-xs text-ink-soft">{t.generate.birthdayNeedAge}</p>
                    )}
                    {birthdayLabelText && (
                      <p className="mt-3 text-xs text-gold">
                        {t.generate.premiereOpensPrefix}
                        {birthdayLabelText}.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Back / Next */}
              <div className="mt-4 flex gap-3">
                {beatIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => goToBeat(beatIndex - 1)}
                    className="min-h-[44px] shrink-0 rounded-full border border-sand bg-cream-soft px-6 text-base font-bold text-ink-soft transition hover:text-ink"
                  >
                    {t.generate.beatBack}
                  </button>
                )}
                <button
                  type="button"
                  onClick={advanceBeat}
                  disabled={!beatValid(beatIndex) || loadingLyrics}
                  className="flex-1 min-h-[44px] rounded-full bg-warm-gradient py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,80,150,0.6)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sand disabled:bg-none disabled:text-ink-soft disabled:shadow-none disabled:hover:translate-y-0 sm:text-lg"
                >
                  {beatIndex === BEAT_COUNT - 1
                    ? loadingLyrics
                      ? t.generate.writingLyrics
                      : t.generate.beatToStudio
                    : t.generate.beatNext}
                </button>
              </div>

              {/* The call sheet — the dossier fills in as beats are answered */}
              <div className="dossier mt-5 rounded-2xl border border-dashed border-sand p-3.5">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
                  {t.generate.callSheetHeading}
                </div>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {[
                    { k: t.generate.dossierStar, v: name.trim(), on: !!name.trim() },
                    { k: t.generate.dossierDirected, v: relationship ? dossierDirectedBy : "", on: !!relationship },
                    {
                      k: t.generate.dossierScene,
                      v: memory.trim() ? `“${memory.trim().slice(0, 34)}${memory.trim().length > 34 ? "…" : ""}”` : "",
                      on: !!memory.trim(),
                    },
                    {
                      k: t.generate.dossierNote,
                      v:
                        noteMode === "voice" && directorNoteVoiceUrl
                          ? t.generate.dossierRecorded
                          : directorNoteText.trim()
                            ? t.generate.dossierWritten
                            : "",
                      on: !!(directorNoteVoiceUrl || directorNoteText.trim()),
                    },
                    { k: t.generate.dossierFeeling, v: feeling, on: !!feeling },
                    { k: t.generate.dossierScore, v: genre, on: !!genre },
                    { k: t.generate.dossierLanguage, v: language, on: !!language },
                    { k: t.generate.dossierCurtain, v: birthdayLabelText, on: !!birthdayLabelText },
                  ].map((row) => (
                    <li key={row.k} className={`flex gap-2 text-ink-soft ${row.on ? "on" : ""}`}>
                      <span className="inline-block min-w-[86px] text-[11.5px] uppercase tracking-[0.05em] text-ink-soft">
                        {row.k}
                      </span>
                      <span className={row.on ? "font-semibold text-ink" : ""}>{row.v || "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── STEP 2 · the studio: co-creation + the "open the curtain" gate ── */}
      {lyrics && !audioUrl && (
        <section className={`relative z-10 mx-auto max-w-xl rounded-[2rem] border ${theme.card} p-5 shadow-sm sm:p-8`}>
          <StudioKicker>{t.generate.actStudio}</StudioKicker>
          <h2 className="font-display text-2xl font-black text-ink">
            {t.generate.studioRecordingPrefix}
            <span className="bg-warm-gradient bg-clip-text text-transparent">
              {name.trim() || t.generate.marqueeYourStar}
            </span>
            {t.generate.studioRecordingSuffix}
          </h2>
          <div className="mt-4">
            <ProducerBubble emoji="🎛️">{t.generate.miloStudio}</ProducerBubble>
          </div>

          {/* Live lyric reveal — the chorus coming to life (read-only). */}
          <div className="rounded-2xl border border-sand bg-cream-soft p-4">
            <span className="inline-block rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-gold">
              {t.generate.studioChorusTag}
            </span>
            <p className="mb-2 mt-3 text-sm font-bold text-ink">{t.generate.studioChorusLabel}</p>
            <div
              className="max-h-52 overflow-y-auto whitespace-pre-wrap border-l-2 border-gold pl-3.5 text-sm leading-relaxed text-cream"
              dir={language === "Arabic" ? "rtl" : "ltr"}
              style={
                language === "Hindi"
                  ? { fontFamily: '"Noto Sans Devanagari", "Mangal", system-ui, sans-serif' }
                  : undefined
              }
              aria-live="polite"
              aria-busy={!loadingMusic}
            >
              {lyrics.raw.slice(0, lyricRevealChars)}
              {lyricRevealChars < lyrics.raw.length && (
                <span aria-hidden className="ml-0.5 inline-block w-[1px] animate-pulse opacity-80">
                  ▍
                </span>
              )}
            </div>
          </div>

          {loadingMusic ? (
            /* Mixing state — the track is rendering. */
            <div className="mt-6">
              <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-jade">
                🎙 {t.generate.actStudio}
              </p>
              <p className="text-center font-display text-lg font-bold text-ink">
                {audioUrl ? t.generate.waitReady : t.generate.studioMixingHeadline}
              </p>
              <div className="mt-5 flex items-end justify-center gap-1.5" aria-hidden>
                {Array.from({ length: 11 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-2 rounded-full bg-warm-gradient animate-eq shadow-[0_0_12px_-2px_rgba(255,126,157,0.6)]"
                    style={{
                      height: 44,
                      animationDelay: `${(i * 0.08).toFixed(2)}s`,
                      animationDuration: `${(0.75 + (i % 4) * 0.14).toFixed(2)}s`,
                    }}
                  />
                ))}
              </div>
              <p className="mt-4 text-center text-sm font-semibold text-ink-soft">
                {LOADING_MESSAGES[loadingMsgIdx]}
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-sand">
                <div className="h-full bg-warm-gradient animate-progress" />
              </div>
              <p className="mt-2 text-center text-xs text-ink-soft">
                {elapsedMs < 60_000 ? t.generate.waitAboutAMinute : t.generate.waitAlmostThere}
              </p>
              {/* Optional wait-time game — pure fun, never blocks. */}
              <WaitGame />
            </div>
          ) : (
            <>
              {/* Photos → premiere scenes */}
              <div className="mt-5 rounded-2xl border border-blush/40 bg-warm-soft p-4">
                <span className="inline-block rounded-full bg-jade/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-jade">
                  {t.generate.coauthorTag}
                </span>
                <p className="mb-3 mt-3 text-sm text-ink-soft">{t.generate.coauthorPhotoLabel}</p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handlePhotoSelect(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhotos || photoUrls.length >= MAX_SLIDESHOW_PHOTOS}
                  className="w-full min-h-[44px] rounded-full border border-blush/50 bg-cream-soft px-5 py-3 text-sm font-extrabold text-ink transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] hover:border-blush disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingPhotos ? t.generate.coauthorPhotoAdding : t.generate.coauthorPhotoCta}
                </button>
                {photoUrls.length > 0 && (
                  <p className="mt-2 text-center text-xs font-semibold text-jade">
                    {t.generate.coauthorPhotoDone.replace("{count}", String(photoUrls.length))}
                  </p>
                )}
                {photoError && (
                  <p role="alert" className="mt-2 text-center text-xs text-blush">
                    {photoError}
                  </p>
                )}
              </div>

              {/* Secret cast link (crowd) */}
              <div className="mt-4 rounded-2xl border border-blush/40 bg-warm-soft p-4">
                <span className="inline-block rounded-lg border border-blush/30 bg-blush/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-blush">
                  {t.generate.studioCastTag}
                </span>
                <p className="mb-3 mt-3 text-sm font-extrabold text-ink">{t.generate.studioCastHeading}</p>
                <p className="mb-3 text-xs text-ink-soft">{t.generate.studioCastBody}</p>
                {!crowdJoinUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={createGroupSong}
                      disabled={crowdCreating}
                      className="w-full min-h-[44px] rounded-full border border-blush/50 bg-cream-soft px-5 py-3 text-sm font-extrabold text-ink transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] hover:border-blush disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {crowdCreating ? t.crowd.creating : t.crowd.cta}
                    </button>
                    {crowdError && (
                      <p role="alert" className="mt-2 text-center text-xs text-blush">
                        {crowdError}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-stretch gap-2">
                      <input
                        readOnly
                        value={crowdJoinUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className={`flex-1 rounded-xl border px-4 py-3 text-sm text-ink outline-none ${theme.input}`}
                      />
                      <button
                        type="button"
                        onClick={copyCrowdLink}
                        className="shrink-0 rounded-full bg-warm-gradient px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                      >
                        {crowdCopied ? t.crowd.copied : t.crowd.copy}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={shareCrowdLink}
                      className="w-full min-h-[44px] rounded-full border border-sand bg-cream-soft py-2.5 text-sm font-bold text-ink transition hover:border-blush"
                    >
                      {t.crowd.share}
                    </button>
                  </div>
                )}
              </div>

              {/* "Where should we send the premiere?" — email + attestation gate */}
              <div className="mt-5 rounded-2xl border border-gold/30 bg-cream-soft p-4">
                <p className="font-display text-base font-black text-ink">{t.generate.studioGateHeading}</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="contact-email" className="mb-2 block text-sm font-bold text-ink">
                      {t.generate.emailLabel}
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder={t.generate.emailPlaceholder}
                      className={`w-full rounded-xl border px-4 py-3.5 text-base text-ink outline-none transition focus:border-jade focus:ring-1 focus:ring-jade ${theme.input}`}
                    />
                    <p className="mt-1.5 text-xs text-ink-soft">{t.generate.emailHint}</p>
                  </div>

                  <label
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-sm text-ink transition ${
                      recipientIsMinor ? "border-gold/30 bg-warm-soft" : "border-sand bg-cream"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={attested}
                      onChange={(e) => setAttested(e.target.checked)}
                      disabled={recipientAge === null}
                      className={`mt-1 h-4 w-4 shrink-0 rounded border-sand ${
                        recipientIsMinor ? "accent-gold" : "accent-jade"
                      }`}
                    />
                    <span className="text-ink-soft">
                      {recipientIsMinor
                        ? `${t.generate.attestationGuardianPrefix}${name.trim() || t.generate.attestationGuardianFallback}.`
                        : t.generate.attestationAdult}
                    </span>
                  </label>

                  {!recipientIsMinor && (
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-sand accent-jade"
                      />
                      <span className="text-ink-soft">{t.generate.marketingConsent}</span>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={generateMusicHandler}
                  disabled={!canGenerateMusic || loadingLyrics || loadingMusic}
                  className="mt-4 w-full min-h-[44px] rounded-full bg-warm-gradient py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,80,150,0.6)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sand disabled:bg-none disabled:text-ink-soft disabled:shadow-none disabled:hover:translate-y-0"
                >
                  {loadingMusic ? t.generate.openCurtainMixing : t.generate.openCurtain}
                </button>
                {!canGenerateMusic && !loadingLyrics && !loadingMusic && missingForMusic && (
                  <p className="mt-2 text-center text-xs text-ink-soft">{missingForMusic}</p>
                )}
                {captureError && (
                  <p role="alert" className="mt-2 text-center text-xs text-blush">
                    {captureError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={generateLyricsHandler}
                  disabled={loadingLyrics || loadingMusic}
                  className="mt-3 w-full text-center text-xs font-bold text-ink-soft underline transition hover:text-ink disabled:opacity-40"
                >
                  {loadingLyrics ? t.generate.rewriting : t.generate.studioRewrite}
                </button>
              </div>

              {/* Optional: personalize the delivery + share design while you decide. */}
              <details className="mt-5 rounded-2xl border border-sand bg-cream-soft/60">
                <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-ink-soft transition hover:text-ink">
                  ✨ {t.generate.deliveryHeading}
                </summary>
                <div className="space-y-5 px-4 pb-5 pt-1">
                  <div>
                    <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                      {t.generate.deliveryHeading}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                      {SHARE_TEMPLATES.map((key) => {
                        const meta = TEMPLATE_LABELS[key];
                        const selected = shareTemplate === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setShareTemplate(key)}
                            disabled={creatingShare}
                            className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              selected
                                ? "border-transparent bg-warm-gradient text-white shadow-md"
                                : "border-sand bg-cream text-ink hover:border-blush"
                            }`}
                          >
                            <span
                              aria-hidden
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: TEMPLATE_ACCENT[key] }}
                            />
                            <span>{meta.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {waitBirthdayDate.trim() && (
                    <div>
                      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                        {t.generate.deliveryHeading}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryMode("scheduled")}
                          aria-pressed={deliveryMode === "scheduled"}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                            deliveryMode === "scheduled"
                              ? "border-blush bg-warm-soft text-ink ring-1 ring-blush"
                              : "border-sand bg-cream text-ink-soft hover:border-blush"
                          }`}
                        >
                          {t.generate.deliveryOnBirthday}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryMode("now")}
                          aria-pressed={deliveryMode === "now"}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                            deliveryMode === "now"
                              ? "border-jade bg-warm-soft text-ink ring-1 ring-jade"
                              : "border-sand bg-cream text-ink-soft hover:border-jade"
                          }`}
                        >
                          {t.generate.deliveryNow}
                        </button>
                      </div>
                      {deliveryMode === "scheduled" && (
                        <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{t.generate.deliveryHint}</p>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </>
          )}
        </section>
      )}

      {errorMsg && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-sm`}>
          <h2 className="font-display text-lg font-bold text-ink">Something went wrong</h2>
          <p className="mt-2 text-sm text-ink-soft">{errorMsg}</p>
          <button
            type="button"
            onClick={resetForRetry}
            className="mt-4 rounded-full bg-jade px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] hover:bg-jade-deep"
          >
            Try again
          </button>
        </section>
      )}

      {/* Collapsed details summary — shown alongside the finished premiere so
          the giver can see the call-sheet recap. Non-destructive: "Edit"
          scrolls back to the flow top rather than mutating state. */}
      {lyrics && audioUrl && (
        <div className="relative z-20 mx-auto mt-2 mb-1 flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-jade/30 bg-warm-soft px-4 py-2.5 text-sm font-semibold text-ink">
          <span aria-hidden className="text-jade">✓</span>
          <span className="min-w-0 truncate">
            For {name.trim() || "them"} · {resolvedGenre ?? genre} · {language}
          </span>
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              try {
                flowTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              } catch {
                // Older browsers may reject the options object; ignore.
              }
            }}
            className="ml-auto min-h-[44px] rounded-full border border-sand bg-cream-soft px-3 py-1 text-xs font-bold text-ink transition hover:border-jade"
          >
            Edit
          </button>
        </div>
      )}

      {lyrics && audioUrl && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-sm`}>
          <h2 className="font-display text-xl font-bold text-ink">Happy Birthday, {name}!</h2>
          <p className="text-sm text-ink-soft">
            {language} • {resolvedGenre ?? genre} • {lyrics.title}
          </p>

          <div className="mt-4 space-y-3">
              {/* The Premiere — the deliberately built peak. Replaces the flat
                  player as the reveal. The full-song source is proxied
                  same-origin so the visualizer reacts to real sound; the
                  paywall's free-preview gate is preserved via previewSeconds
                  (playback pauses/clamps at PREVIEW_SECONDS just like the old
                  player), and onPreviewLimit drives the same unlock CTA. */}
              <PremiereReveal
                recipientName={name.trim()}
                directorName={directorName}
                audioSrc={audioProxyUrl ?? audioUrl}
                songTitle={lyrics.title}
                previewSeconds={PREVIEW_SECONDS}
                onPreviewLimit={() => {
                  if (!previewEnded) setPreviewEnded(true);
                }}
                onContinue={openShareUi}
                continueLabel={t.premiere.continueLabel}
                labels={{
                  overline: t.premiere.overline,
                  introPrefix: t.premiere.introPrefix,
                  introSuffix: t.premiere.introSuffix,
                  openCta: t.premiere.openCta,
                  marqueeOverline: t.premiere.marqueeOverline,
                  pause: t.premiere.pause,
                  replay: t.premiere.replay,
                  director: t.premiere.director,
                }}
              />
              <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-jade">
                {t.paywall.previewLabelPrefix}{t.paywall.previewLabelSuffix}
              </p>

              {/* Video teaser — the shareable video is part of the unlock, so
                  show it as a tangible 9:16 poster (in the chosen template)
                  rather than only a bullet. Makes the result feel like a full
                  gift (song + video) and reinforces value at the buy moment. */}
              <div className="flex items-center gap-4 rounded-3xl border border-sand bg-cream-soft p-4">
                <div
                  className={`relative aspect-[9/16] w-[72px] shrink-0 overflow-hidden rounded-xl ${PREVIEW_BG[shareTemplate]}`}
                >
                  <div className="absolute inset-0 grid place-items-center px-2 text-center">
                    <p
                      className="text-[11px] font-extrabold leading-tight"
                      style={PREVIEW_TEXT_STYLE[shareTemplate]}
                    >
                      Happy Birthday, {name.trim() || "you"}!
                    </p>
                  </div>
                  <span aria-hidden className="absolute inset-0 grid place-items-center">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-black/45 text-sm text-white backdrop-blur-sm">
                      ▶
                    </span>
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">🎬 A shareable video, too</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    A vertical video of {name.trim() || "their"}’s song — made for WhatsApp,
                    Telegram &amp; Stories. Yours to download the moment you unlock.
                  </p>
                </div>
              </div>

              {/* The buy moment — the preview hooked them; now unlock everything. */}
              <div className="rounded-3xl border border-jade/30 bg-warm-soft p-5">
                <p className="font-display text-base font-extrabold text-ink">
                  {previewEnded
                    ? `${t.paywall.unlockHeadlineLovedPrefix}${t.paywall.unlockHeadlinePrefix}${name}${t.paywall.unlockHeadlineSuffix}`
                    : `${t.paywall.unlockHeadlinePrefix}${name}${t.paywall.unlockHeadlineSuffix}`}
                </p>

                {/* Good-better-best: Standard vs Deluxe. Default = Standard. */}
                <div className="mt-3 space-y-2.5 text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setUnlockPlan("full");
                      try {
                        track("plan_selected", { plan: "full", tier: shareTier ?? "unknown" });
                      } catch {
                        // Analytics is non-critical; swallow.
                      }
                    }}
                    aria-pressed={unlockPlan === "full"}
                    className={`block w-full rounded-2xl border p-3.5 text-left transition ${
                      unlockPlan === "full"
                        ? "border-jade bg-cream-soft ring-1 ring-jade"
                        : "border-sand bg-cream-soft hover:border-jade"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-ink">{t.paywall.standard}</span>
                      <span className="text-sm font-extrabold text-ink">{shareTier ? TIER_PRICE_LABEL[shareTier] : ""}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
                      <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{t.paywall.bulletCompleteSong}</span></li>
                      <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{t.paywall.bulletMp3}</span></li>
                      <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{t.paywall.bulletShareVideo}</span></li>
                      <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{t.paywall.bulletReplay}</span></li>
                    </ul>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUnlockPlan("deluxe");
                      try {
                        track("plan_selected", { plan: "deluxe", tier: shareTier ?? "unknown" });
                      } catch {
                        // Analytics is non-critical; swallow.
                      }
                    }}
                    aria-pressed={unlockPlan === "deluxe"}
                    className={`block w-full rounded-2xl border p-3.5 text-left transition ${
                      unlockPlan === "deluxe"
                        ? "border-gold bg-cream-soft ring-1 ring-gold"
                        : "border-sand bg-cream-soft hover:border-jade"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-ink">
                        {t.paywall.deluxe} <span className="ml-1 rounded-full bg-warm-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t.paywall.mostChosen}</span>
                      </span>
                      <span className="text-sm font-extrabold text-ink">{shareTier ? DELUXE_PRICE_LABEL[shareTier] : ""}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
                      <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{t.paywall.bulletEverythingStandard}</span></li>
                      <li className="flex items-start gap-2"><span className="text-gold">★</span><span className="font-semibold text-ink">{t.paywall.bulletSlideshow}</span></li>
                    </ul>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUnlockPlan("production");
                      try {
                        track("plan_selected", { plan: "production", tier: shareTier ?? "unknown" });
                      } catch {
                        // Analytics is non-critical; swallow.
                      }
                    }}
                    aria-pressed={unlockPlan === "production"}
                    className={`block w-full rounded-2xl border p-3.5 text-left transition ${
                      unlockPlan === "production"
                        ? "border-blush bg-cream-soft ring-1 ring-blush"
                        : "border-sand bg-cream-soft hover:border-blush"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-ink">
                        {t.paywall.production} <span aria-hidden>🎬</span>
                      </span>
                      <span className="text-sm font-extrabold text-ink">{shareTier ? PRODUCTION_PRICE_LABEL[shareTier] : ""}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
                      <li className="flex items-start gap-2"><span className="text-jade">✓</span><span>{t.paywall.bulletEverythingDeluxe}</span></li>
                      <li className="flex items-start gap-2"><span className="text-blush">☎</span><span className="font-semibold text-ink">{t.paywall.bulletCall}</span></li>
                    </ul>
                  </button>
                </div>

                {/* Live-musician anchor — frames the tiers as the smart middle. */}
                <p className="mt-2.5 text-center text-[11px] text-ink-soft">
                  {t.paywall.liveAnchorLabel}{" "}
                  <span className="font-bold text-ink">{LIVE_ANCHOR_PRICE_LABEL}</span>
                </p>

                {unlockPlan === "production" && (
                  <ProductionCallFields
                    recipientName={name}
                    locale={locale}
                    value={callSetup}
                    onChange={setCallSetup}
                  />
                )}

                <button
                  type="button"
                  onClick={unlockFullSong}
                  disabled={
                    !shareUrl ||
                    unlocking ||
                    (unlockPlan === "production" && !isProductionCallReady(callSetup))
                  }
                  className="mt-3 w-full rounded-full bg-warm-gradient py-3.5 text-sm font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,111,145,0.7)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {unlocking
                    ? t.paywall.openingCheckout
                    : !shareUrl
                      ? t.paywall.preparingSong
                      : unlockPlan === "production"
                        ? `${t.paywall.unlockProductionPrefix}${shareTier ? ` · ${PRODUCTION_PRICE_LABEL[shareTier]}` : ""} →`
                        : unlockPlan === "deluxe"
                          ? `${t.paywall.unlockDeluxePrefix}${shareTier ? ` · ${DELUXE_PRICE_LABEL[shareTier]}` : ""} →`
                          : `${t.paywall.unlockStandardPrefix}${shareTier ? ` · ${TIER_PRICE_LABEL[shareTier]}` : ""} →`}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-jade">
                  <span aria-hidden>✓</span>{" "}
                  <a
                    href="/refund"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-jade/40 underline-offset-2 hover:decoration-jade"
                  >
                    {t.paywall.moneyBack}
                  </a>
                </p>
                <p className="mt-1 text-center text-[11px] text-ink-soft">
                  {t.paywall.secureCheckout}
                </p>
              </div>

              {/* Optional: add photos for a Ken-Burns slideshow set to the song.
                  Entirely optional — skipping is fine. The photos persist on the
                  share; the slideshow video renders after unlock. */}
              <div className="rounded-3xl border border-sand bg-cream-soft p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-ink">
                      📸 Add photos for a slideshow
                      <span className="ml-2 rounded-full bg-warm-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Deluxe
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                      Part of Deluxe — add up to {MAX_SLIDESHOW_PHOTOS} photos and we&apos;ll
                      turn them into a Ken-Burns video set to {name || "the"}&apos;s song
                      after you unlock. Adding photos selects Deluxe.
                    </p>
                  </div>
                </div>

                {photoUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photoUrls.map((url, i) => (
                      <div
                        key={url}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-sand bg-cream"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote R2 thumbnails; no need for next/image optimization here */}
                        <img
                          src={url}
                          alt={`Slideshow photo ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          aria-label={`Remove photo ${i + 1}`}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handlePhotoSelect(e.target.files)}
                />

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhotos || photoUrls.length >= MAX_SLIDESHOW_PHOTOS}
                  className="mt-3 w-full rounded-xl border border-sand bg-cream py-2.5 text-sm font-semibold text-ink transition hover:border-jade disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadingPhotos
                    ? "Uploading…"
                    : photoUrls.length >= MAX_SLIDESHOW_PHOTOS
                      ? `Maximum ${MAX_SLIDESHOW_PHOTOS} photos added`
                      : photoUrls.length > 0
                        ? "Add more photos"
                        : "Choose photos"}
                </button>

                {photoError && (
                  <p className="mt-2 text-xs text-blush">{photoError}</p>
                )}
              </div>
            </div>
        </section>
      )}

      {/* Send-this-song card only renders once the share artifact is ready
          (or an error fired). The audio + inline "wrapping it up" indicator
          above already keeps the user informed during the render window —
          this card slides in fresh, in sync with the second confetti burst. */}
      {audioUrl && lyrics && (shareUrl || shareError) && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-sm animate-fade-in`}>
          <h2 className="font-display text-lg font-bold text-ink">🔗 Send this song</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Your song is saved as a <span className="font-semibold text-ink">{TEMPLATE_LABELS[shareTemplate].name}</span> share — open the share page to send it.
          </p>

          {shareUrl && (
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={openShareUi}
                className="w-full rounded-full bg-jade py-4 text-base font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] hover:bg-jade-deep"
              >
                🔗 Open share page
              </button>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm text-ink outline-none ${theme.input}`}
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="rounded-full bg-warm-gradient px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                >
                  {copied ? "✓ Copied" : "Copy link"}
                </button>
              </div>

              {/* Scheduled premiere: the shared link shows a countdown until the
                  birthday; give the giver a private preview link to see it now. */}
              {premierePreviewUrl && premiereDeliverAt && (
                <a
                  href={premierePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-blush/40 bg-warm-soft px-4 py-3 text-center text-sm font-bold text-ink transition hover:-translate-y-0.5"
                >
                  {t.generate.deliveryPreviewLink}
                </a>
              )}

              {/* Optional promotional-use permission. Shown only after the song
                  is shareable, and never on minor-recipient flows. Prominent but
                  fully optional — it does not gate the share CTA above. */}
              {!recipientIsMinor && (
                <div className="mt-2 rounded-2xl border border-sand bg-cream-soft p-4">
                  <p className="text-sm font-bold text-ink">💜 Proud of this one? Let it inspire others.</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Yes — Sing My Birthday can feature my song in highlights &amp; ads.
                    You can change your mind anytime; we&apos;ll never share private
                    details, and never for songs made for kids.
                  </p>
                  {promoResponded ? (
                    <p className="mt-3 text-sm font-semibold text-jade">
                      {promoGranted
                        ? "Thank you! You can feature it 💜"
                        : "No problem — we won't feature it."}
                      {promoSaved && <span className="ml-1 text-ink-soft">Saved ✓</span>}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => submitPromoPermission(true)}
                        className="rounded-full bg-jade px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] hover:bg-jade-deep"
                      >
                        Yes, you can feature it
                      </button>
                      <button
                        type="button"
                        onClick={() => submitPromoPermission(false)}
                        className="rounded-full border border-sand bg-cream-soft px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-jade"
                      >
                        No thanks
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {shareError && (
            <p className="mt-3 text-sm text-blush">{shareError}</p>
          )}
        </section>
      )}

      <footer className="relative z-20 mt-8 text-center text-xs text-ink-soft">
        Made with 💜 for birthday celebrations
      </footer>

      {showConfetti && <Confetti />}
    </main>
  );
}