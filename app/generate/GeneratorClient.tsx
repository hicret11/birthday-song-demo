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
import { track } from "@vercel/analytics";
import { getAnonId, logClientEvent } from "@/lib/client-events";

const LOADING_MESSAGES = [
  "Sprinkling the candles…",
  "Tuning the chorus…",
  "Adding the icing…",
  "Wrapping the bow…",
  "✨ This is where the magic happens…",
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
type TabKey = "basic" | "advanced";

const POLL_INTERVAL_MS = 2_000;
const LONG_WAIT_HINT_MS = 90_000;
const GENERATION_TIMEOUT_MS = 180_000;

const genres = ["🎤 Pop", "🎷 R&B", "🎸 Rock", "🎹 Jazz", "🎧 Hip-Hop", "🎛️ Electronic"];
const languages = ["English", "Turkish", "Spanish", "French", "Arabic", "Hindi", "Russian"];

const themes = {
  dark: {
    name: "Dark Neon",
    desc: "Vibrant & energetic",
    pageBg: "from-[#070019] via-[#12062f] to-[#1e1646]",
    title: "from-pink-400 via-purple-300 to-blue-300",
    card: "bg-white/10 border-white/15",
    text: "text-white",
    sub: "text-gray-300",
    input: "bg-white/10 border-white/20 placeholder:text-gray-400",
    accent: "from-purple-500 via-fuchsia-500 to-pink-500",
    effect: "emoji",
    emojis: ["🎵", "🎶", "🎂", "🎉", "🎁", "🎈", "✨", "🎊", "🥳", "🪩", "🍰", "🎤"],
  },
  light: {
    name: "Light Dream",
    desc: "Soft & clean",
    pageBg: "from-[#eef7ff] via-[#fff6fb] to-[#f4e8ff]",
    title: "from-pink-500 via-purple-500 to-sky-500",
    card: "bg-white/80 border-white",
    text: "text-gray-900",
    sub: "text-gray-600",
    input: "bg-white border-gray-200 placeholder:text-gray-400",
    accent: "from-sky-400 via-pink-400 to-purple-400",
    effect: "emoji",
    emojis: ["☁️", "🎀", "🎂", "🎈", "✨", "💖", "🎶", "🧁", "🎁", "🌸", "🍰", "🎵"],
  },
  party: {
    name: "Birthday Party",
    desc: "Fun & colorful",
    pageBg: "from-[#ff8a8a] via-[#ffb86b] to-[#ff4faf]",
    title: "from-white via-yellow-100 to-white",
    card: "bg-white/70 border-white",
    text: "text-gray-900",
    sub: "text-gray-700",
    input: "bg-white/80 border-white placeholder:text-gray-500",
    accent: "from-orange-500 via-pink-500 to-rose-500",
    effect: "emoji",
    emojis: ["🎉", "🎊", "🥳", "🎈", "🎂", "🎁", "🍰", "✨", "🎵", "🪅", "🧁", "🎶"],
  },
  pastel: {
    name: "Soft Pastel",
    desc: "Calm & gentle",
    pageBg: "from-[#ffd6ee] via-[#e6dcff] to-[#d9f1ff]",
    title: "from-pink-500 via-purple-500 to-blue-400",
    card: "bg-white/75 border-white",
    text: "text-gray-900",
    sub: "text-gray-600",
    input: "bg-white/85 border-white placeholder:text-gray-400",
    accent: "from-pink-400 via-purple-400 to-sky-400",
    effect: "emoji",
    emojis: ["🧸", "🎀", "🎂", "🎈", "✨", "🌈", "🎶", "🧁", "💖", "🎁", "🍭", "🎵"],
  },
  luxury: {
    name: "Luxury Night",
    desc: "Elegant & premium",
    pageBg: "from-[#030303] via-[#14100a] to-[#3b2700]",
    title: "from-yellow-200 via-amber-400 to-yellow-100",
    card: "bg-black/45 border-yellow-500/25",
    text: "text-white",
    sub: "text-yellow-100/70",
    input: "bg-white/10 border-yellow-400/20 placeholder:text-yellow-100/40",
    accent: "from-yellow-500 via-amber-500 to-yellow-300",
    effect: "emoji",
    emojis: ["✨", "🌙", "🎂", "🎁", "🥂", "🎵", "🎶", "⭐", "🍰", "🎈", "💫", "🎉"],
  },
  confetti: {
    name: "Confetti",
    desc: "Classic party motion",
    pageBg: "from-[#0d0521] via-[#120e3a] to-[#071426]",
    title: "from-purple-300 via-pink-300 to-blue-300",
    card: "bg-white/10 border-white/15",
    text: "text-white",
    sub: "text-gray-300",
    input: "bg-white/10 border-white/20 placeholder:text-gray-400",
    accent: "from-purple-500 via-fuchsia-500 to-indigo-500",
    effect: "confetti",
    emojis: [],
  },
  balloons: {
    name: "Balloons",
    desc: "Floating birthday balloons",
    pageBg: "from-[#1a001a] via-[#2d0040] to-[#0f0020]",
    title: "from-pink-300 via-purple-300 to-fuchsia-300",
    card: "bg-white/10 border-white/15",
    text: "text-white",
    sub: "text-gray-300",
    input: "bg-white/10 border-white/20 placeholder:text-gray-400",
    accent: "from-pink-500 via-purple-500 to-fuchsia-500",
    effect: "balloons",
    emojis: [],
  },
  bubbles: {
    name: "Bubbles",
    desc: "Soft floating bubbles",
    pageBg: "from-[#001a0e] via-[#002233] to-[#001a10]",
    title: "from-emerald-300 via-cyan-300 to-sky-300",
    card: "bg-white/10 border-white/15",
    text: "text-white",
    sub: "text-gray-300",
    input: "bg-white/10 border-white/20 placeholder:text-gray-400",
    accent: "from-emerald-400 via-cyan-400 to-sky-500",
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
};

export default function GeneratorClient({ venue }: Props) {
  const [tab, setTab] = useState<TabKey>("basic");
  const [themeKey, setThemeKey] = useState<ThemeKey>("dark");
  const [themeOpen, setThemeOpen] = useState(false);
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
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const PREVIEW_SECONDS = 20;
  // Display-only mirror of TIER_PRICE_DISPLAY in lib/pricing-tiers.ts. The real
  // charge is always the Stripe price_id; keep these in sync for the CTA label.
  const TIER_PRICE_LABEL: Record<"A" | "B" | "C", string> = { A: "$9.99", B: "$5.99", C: "$2.99" };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<null | (() => void)>(null);
  const completeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recipientAge = parseRecipientAge(ageInput);
  const recipientIsMinor = recipientAge !== null && recipientAge < 18;

  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (!loadingMusic) return;
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
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, [audioUrl]);
  // Second confetti burst when the share artifact finally lands — gives the
  // "Open share page" button its own reveal moment after the audio reveal.
  useEffect(() => {
    if (!shareUrl) return;
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
  const missingMessage = !name.trim()
    ? "Add their name"
    : recipientAge === null
      ? "Tell us how old they're turning"
      : !genre
        ? "Pick a genre"
        : !trimmedEmail
          ? "Add an email"
          : !emailValid
            ? "Check the email format"
            : !attested
              ? "Tick the box to continue"
              : null;
  const canGenerate = missingMessage === null;
  const musicLocked = loadingMusic || jobId !== null || audioUrl !== null;
  const audioProxyUrl = audioUrl ? toAudioProxyUrl(audioUrl) : null;

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

    if (theme.effect === "confetti") cleanupRef.current = runConfetti(canvas);
    else if (theme.effect === "balloons") cleanupRef.current = runBalloons(canvas);
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
    setElapsedMs(0);
    const tick = () => setElapsedMs(Date.now() - startedAt);
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [loadingLyrics, loadingMusic]);

  async function generateLyricsHandler() {
    if (!canGenerate || loadingLyrics || loadingMusic) return;

    track("gen_lyrics_click", { venue_slug: venue?.slug ?? "none" });

    const captureOk = await ensureCapture();
    if (!captureOk) return;

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
    if (!lyrics || loadingLyrics || loadingMusic) return;

    track("gen_music_click", { venue_slug: venue?.slug ?? "none" });

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

  function updateSectionText(index: number, text: string) {
    setEditableSections((prev) => prev.map((s, i) => (i === index ? { ...s, text } : s)));
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
      ...(cakeStyle ? { cake_style: cakeStyle } : {}),
      ...(candleColor ? { candle_color: candleColor } : {}),
      ...(personalNote.trim() ? { personal_note: personalNote.trim() } : {}),
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
    setUnlocking(true);
    setShareError(null);
    try {
      track("unlock_click", { share_id: shareId, tier: shareTier ?? "unknown" });
      const res = await fetch("/api/stripe/checkout-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
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

  const basicFields = (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <label className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
          👤 Who’s the birthday star?
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter their name..."
          className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
        />
      </div>

      <div>
        <label htmlFor="pronunciation-hint" className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
          🔤 How is the name pronounced? <span className="opacity-60">(optional)</span>
        </label>
        <input
          id="pronunciation-hint"
          value={pronunciationHint}
          onChange={(e) => setPronunciationHint(e.target.value.slice(0, 80))}
          placeholder="e.g., 'sha-VON' for Siobhan"
          maxLength={80}
          className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
        />
        <p className="mt-1.5 text-xs opacity-70">
          Tip: write it the way you’d say it out loud. ‘KAY-tlin’ for Caitlin, ‘EE-fa’ for Aoife.
        </p>

        <div className="mt-3">
          {micState === "warming" ? (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-bold">
              <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
              <span>Get ready…</span>
            </div>
          ) : micState === "recording" ? (
            <button
              type="button"
              onClick={stopMicRecording}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm font-bold transition hover:bg-rose-500/25"
            >
              <span aria-hidden className="flex h-5 items-end gap-[3px]">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="block h-full w-[3px] rounded bg-rose-200 animate-pulse-bar"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </span>
              <span>🎙️ Speak now! ⏹ Stop (auto-stops at 4s)</span>
            </button>
          ) : micState === "transcribing" ? (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold opacity-80">
              ✨ Reading the pronunciation…
            </div>
          ) : (
            <button
              type="button"
              onClick={startMicRecording}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10"
            >
              <span aria-hidden>🎤</span> Or just say the name
            </button>
          )}
          {micError && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {micError}
            </p>
          )}
          <p className="mt-1.5 text-[11px] opacity-60">
            Audio is sent for transcription and discarded. Not stored.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="recipient-age" className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
          🎂 How old are they turning?
        </label>
        <input
          id="recipient-age"
          type="number"
          inputMode="numeric"
          min={MIN_AGE}
          max={MAX_AGE}
          value={ageInput}
          onChange={(e) => setAgeInput(e.target.value)}
          placeholder="e.g., 30"
          className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
        />
      </div>

      <div>
        <label htmlFor="sender-name" className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
          ✍️ Your Name (Sender)
        </label>
        <input
          id="sender-name"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value.slice(0, 50))}
          placeholder="Optional — shown on the share page"
          maxLength={50}
          className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
        />
      </div>

      <div>
        <label className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
          🌍 Choose language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
        >
          {languages.map((lang) => (
            <option key={lang} className="text-gray-900">
              {lang}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-3 block text-[clamp(12px,2.5vw,14px)] font-bold">
          🎵 Pick a genre
        </label>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
          {genres.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setGenre(item)}
              className={`rounded-2xl border px-3 py-3 text-[clamp(12px,2.7vw,14px)] font-bold transition hover:-translate-y-1 ${
                genre === item
                  ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                  : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setGenre("🎲 Surprise Me")}
            className={`col-span-2 md:col-span-3 rounded-2xl border border-dashed px-4 py-3.5 text-[clamp(14px,3vw,16px)] font-extrabold transition hover:-translate-y-1 ${
              genre === "🎲 Surprise Me"
                ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                : "border-white/30 bg-white/10 hover:bg-white/15"
            }`}
          >
            🎲 Surprise Me!
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="style-notes" className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
          ✍️ Anything specific to mention? <span className="opacity-60">(optional)</span>
        </label>
        <input
          id="style-notes"
          value={styleNotes}
          onChange={(e) => setStyleNotes(e.target.value.slice(0, 200))}
          placeholder="e.g., 'their favorite band is Coldplay,' 'they love running,' 'mention their dog Max'"
          maxLength={200}
          className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
        />
        <p className="mt-1.5 text-xs opacity-70">
          Personal details, a music style, an artist reference, or a mood — we weave it into the lyrics and the music.
        </p>
      </div>
    </div>
  );

  return (
    <main
      className={`relative min-h-screen overflow-x-hidden bg-gradient-to-br ${theme.pageBg} ${theme.text} px-4 py-6 sm:py-8 transition-all duration-700`}
    >
      <style>{`
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
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
      `}</style>

      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.pageBg} moving-bg`} />

      <canvas ref={canvasRef} className="fixed inset-0 z-[1] pointer-events-none select-none" />

      {theme.effect === "emoji" && (
        <div className="absolute inset-0 z-[2] pointer-events-none select-none">
          {theme.emojis.map((emoji, index) => {
            const positions = [
              ["8%", "5%"], ["14%", "82%"], ["28%", "9%"], ["35%", "88%"],
              ["54%", "6%"], ["62%", "86%"], ["78%", "12%"], ["82%", "76%"],
              ["20%", "23%"], ["72%", "28%"], ["18%", "65%"], ["50%", "70%"],
            ];

            return (
              <div
                key={index}
                className={`absolute text-4xl md:text-6xl opacity-60 drop-shadow-2xl ${
                  index % 2 === 0 ? "float-one" : "float-two"
                }`}
                style={{
                  top: positions[index][0],
                  left: positions[index][1],
                  animationDelay: `${index * 0.45}s`,
                }}
              >
                {emoji}
              </div>
            );
          })}
        </div>
      )}

      {venue && (
        <div
          className="relative z-20 mx-auto mb-4 flex max-w-5xl items-center gap-2 rounded-r-xl border-l-2 bg-white/5 px-4 py-2 text-sm font-semibold backdrop-blur"
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
          src="/brand/logo-mark.png"
          alt="Sing My Birthday"
          width={88}
          height={88}
          priority
          className="mx-auto mb-4 drop-shadow-[0_8px_22px_rgba(236,72,153,0.40)]"
        />
        <div className="mb-3 flex items-center justify-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold backdrop-blur sm:text-sm">
            ✨ AI-Powered
          </div>

          <div className="relative inline-flex">
            <button
              type="button"
              onClick={() => setThemeOpen(!themeOpen)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold shadow-xl backdrop-blur transition hover:bg-white/15 sm:text-sm"
            >
              🎨 Theme
            </button>

            {themeOpen && (
              <div className="fixed left-1/2 top-16 z-[9999] max-h-[80vh] w-[92vw] max-w-sm -translate-x-1/2 overflow-y-auto rounded-3xl border border-white/20 bg-black/90 p-4 text-white shadow-2xl backdrop-blur-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Choose Theme</h3>
                  <button type="button" onClick={() => setThemeOpen(false)}>✕</button>
                </div>

                <div className="space-y-3">
                  {Object.entries(themes).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setThemeKey(key as ThemeKey);
                        setThemeOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        themeKey === key
                          ? "border-purple-400 bg-purple-500/30"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className={`h-12 w-16 shrink-0 rounded-xl bg-gradient-to-br ${item.pageBg}`} />
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="text-xs text-gray-300">{item.desc}</p>
                      </div>
                      {themeKey === key && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <h1
          className={`bg-gradient-to-r ${theme.title} bg-clip-text pb-3 text-[clamp(36px,8vw,72px)] font-extrabold leading-[1.15] text-transparent`}
        >
          Birthday Song Generator
        </h1>

        <p className={`text-[clamp(14px,3vw,18px)] ${theme.sub}`}>
          Create a personalized birthday song in seconds
        </p>
      </header>

      <section
        className={`relative z-10 mx-auto max-w-xl rounded-[2rem] border ${theme.card} p-[clamp(18px,4vw,32px)] shadow-2xl backdrop-blur-2xl`}
      >
        <div className="mb-5 flex gap-3">
          <button
            type="button"
            onClick={() => setTab("basic")}
            className={`flex-1 rounded-2xl border py-3 text-[clamp(13px,3vw,16px)] font-bold transition ${
              tab === "basic"
                ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                : "border-white/15 bg-white/5 opacity-75"
            }`}
          >
            ♪ Basic
          </button>

          <button
            type="button"
            onClick={() => setTab("advanced")}
            className={`flex-1 rounded-2xl border py-3 text-[clamp(13px,3vw,16px)] font-bold transition ${
              tab === "advanced"
                ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                : "border-white/15 bg-white/5 opacity-75"
            }`}
          >
            ⚙ Advanced
          </button>
        </div>

        {tab === "basic" && basicFields}

        {tab === "advanced" && (
          <div className="space-y-5">
            {basicFields}

            <div className="border-t border-white/10 pt-5">
              <p className="mb-4 text-sm font-bold opacity-80">
                ✨ Advanced personalization
              </p>

              <div className="space-y-4">
                <input
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="Who is this person to you?"
                  className={`w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />
                <input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="What is their profession?"
                  className={`w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />
                <textarea
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="What is a special memory you share?"
                  rows={2}
                  className={`w-full resize-none rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />
                <textarea
                  value={extras}
                  onChange={(e) => setExtras(e.target.value)}
                  placeholder="Anything else you want to add?"
                  rows={3}
                  className={`w-full resize-none rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <label htmlFor="contact-email" className="mb-2 block text-[clamp(12px,2.5vw,14px)] font-bold">
            📬 Where should we send the song?
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            className={`w-full rounded-2xl border px-4 py-3.5 text-[clamp(14px,3vw,16px)] outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
          />
          <p className="mt-1.5 text-xs opacity-70">So we can save your song.</p>
        </div>

        <label
          className={`mt-5 flex items-start gap-3 rounded-2xl border p-3 text-sm transition ${
            recipientIsMinor
              ? "border-amber-300/30 bg-amber-300/5"
              : "border-white/10 bg-white/5"
          }`}
        >
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={recipientAge === null}
            className={`mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 ${
              recipientIsMinor ? "accent-amber-400" : "accent-purple-500"
            }`}
          />
          <span className="opacity-90">
            {recipientIsMinor
              ? `I am 18 or older and the parent or legal guardian of ${name.trim() || "this child"}.`
              : "I am 18 or older."}
          </span>
        </label>

        {/* Optional reminder/marketing opt-in. Hidden on child-recipient flows
            so we never solicit marketing in a child-directed session. */}
        {!recipientIsMinor && (
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 accent-purple-500"
            />
            <span className="opacity-70">
              Email me a birthday reminder next year and the occasional offer. (Optional)
            </span>
          </label>
        )}

        <button
          type="button"
          onClick={generateLyricsHandler}
          disabled={!canGenerate || loadingLyrics || loadingMusic}
          className={`mt-4 w-full rounded-2xl bg-gradient-to-r ${theme.accent} py-4 text-[clamp(15px,3vw,18px)] font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {loadingLyrics ? "Writing lyrics..." : "✨ Write Lyrics"}
        </button>

        {!canGenerate && !loadingLyrics && !loadingMusic && missingMessage && (
          <p className="mt-2 text-center text-xs text-gray-400">{missingMessage}</p>
        )}

        {captureError && (
          <p role="alert" className="mt-2 text-center text-xs text-rose-300">
            {captureError}
          </p>
        )}

        {loadingLyrics && (
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs opacity-70">
              <span>Writing lyrics...</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className={`h-full animate-pulse bg-gradient-to-r ${theme.accent}`} style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {loadingMusic && (
          <div className="mt-6">
            {/* Personality layer — rotating microcopy stays at the top. */}
            <p className="text-center text-base font-bold opacity-90">
              {audioUrl ? "Done! 🎉" : LOADING_MESSAGES[loadingMsgIdx]}
            </p>

            {/* Simulated progress: 75s linear → 95%, jumps to 100% on completion. */}
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full bg-gradient-to-r ${theme.accent} ${audioUrl ? "" : "animate-progress"}`}
                style={
                  audioUrl
                    ? { width: "100%", transition: "width 0.6s ease-out" }
                    : undefined
                }
              />
            </div>

            {/* Countdown label */}
            <p className="mt-2 text-center text-xs opacity-70">
              {audioUrl
                ? "Your song is ready"
                : elapsedMs < 60_000
                  ? "Your song will be ready in about a minute"
                  : "Almost there…"}
            </p>

            {/* Live lyric reveal — Claude's response already exists by the
                time Suno starts working, so this is a UX device that makes
                the ~60s wait feel productive rather than passive. The
                pulsing 🎵 hints that music is being layered onto the words. */}
            {lyrics && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                  <span aria-hidden className="inline-block animate-pulse">🎵</span>
                  <span>Writing your song</span>
                </div>
                <div
                  className="max-h-48 overflow-y-auto rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  dir={language === "Arabic" ? "rtl" : "ltr"}
                  style={
                    language === "Hindi"
                      ? { fontFamily: '"Noto Sans Devanagari", "Mangal", system-ui, sans-serif' }
                      : undefined
                  }
                  aria-live="polite"
                  aria-busy={!audioUrl}
                >
                  {lyrics.raw.slice(0, lyricRevealChars)}
                  {!audioUrl && lyricRevealChars < lyrics.raw.length && (
                    <span aria-hidden className="ml-0.5 inline-block w-[1px] animate-pulse opacity-80">
                      ▍
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Template picker — pick during the wait. The selected template
                locks in when createShareLink() auto-fires on song completion. */}
            <div className="mt-6">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest opacity-60">
                Pick a design while you wait
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
                      disabled={!!audioUrl || creatingShare}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                          : "border-white/15 bg-white/5 hover:bg-white/10"
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

            {/* Preview card — shows the recipient name styled in the selected
                template. Helps the user pick something they like. */}
            {name.trim() && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/15">
                <div className={`px-5 py-7 text-center ${PREVIEW_BG[shareTemplate]}`}>
                  <p className="text-[11px] font-bold uppercase tracking-widest opacity-60" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Preview
                  </p>
                  <p
                    className="mt-2 text-2xl font-extrabold leading-tight"
                    style={PREVIEW_TEXT_STYLE[shareTemplate]}
                  >
                    Happy Birthday, {name.trim()}!
                  </p>
                  {personalNote.trim() && (
                    <p
                      className="mt-2 text-xs italic opacity-80"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      {personalNote.trim()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* "Make it Yours" personalization chain. All three picks are
                optional — server validates against closed enums (cake,
                candle) and a length cap (note); empty values fall back to
                the default render. */}
            <div className="mt-6 space-y-4">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest opacity-60">
                Make it yours (optional)
              </p>

              {/* Cake + candle pickers are gated off until a future visual
                  pass — the overlay path was rolled back because the
                  template MP4s already include cake/candle imagery and the
                  overlays conflicted visually. The state hooks are kept so
                  flipping NEXT_PUBLIC_ENABLE_VISUAL_PICKS="true" re-exposes
                  the UI without any other code changes. */}
              {VISUAL_PICKS_ENABLED && (
                <>
                  <div>
                    <p className="mb-2 text-xs font-semibold opacity-75">
                      Pick a cake
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {CAKE_STYLES.map((style) => {
                        const selected = cakeStyle === style;
                        return (
                          <button
                            key={style}
                            type="button"
                            onClick={() =>
                              setCakeStyle((prev) => (prev === style ? null : style))
                            }
                            className="flex flex-col items-center gap-1 rounded-2xl bg-transparent p-1 transition hover:-translate-y-0.5"
                            aria-pressed={selected}
                          >
                            <CakeIcon style={style} selected={selected} />
                            <span className="text-[10px] font-bold opacity-80">
                              {CAKE_LABELS[style]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold opacity-75">
                      Candle color
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CANDLE_COLORS.map((color) => {
                        const selected = candleColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() =>
                              setCandleColor((prev) => (prev === color ? null : color))
                            }
                            aria-label={color}
                            aria-pressed={selected}
                            className={`h-8 w-8 rounded-full transition hover:-translate-y-0.5 ${
                              selected
                                ? "ring-2 ring-white ring-offset-2 ring-offset-transparent"
                                : "ring-1 ring-white/30"
                            }`}
                            style={{ backgroundColor: CANDLE_HEX[color] }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="personal-note"
                  className="mb-1 block text-xs font-semibold opacity-75"
                >
                  Add a personal note
                </label>
                <input
                  id="personal-note"
                  type="text"
                  value={personalNote}
                  onChange={(e) =>
                    setPersonalNote(e.target.value.slice(0, PERSONAL_NOTE_MAX_LEN))
                  }
                  maxLength={PERSONAL_NOTE_MAX_LEN}
                  placeholder="Wishing you the best year yet…"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-purple-400"
                />
                <p className="mt-1 text-right text-[10px] opacity-50">
                  {personalNote.trim().length}/{PERSONAL_NOTE_MAX_LEN}
                </p>
              </div>
            </div>

            {/* Wait-state capture — optional, additive, doesn't gate or delay
                song generation. Values flow into the auto-share payload when
                the song completes. */}
            <div className="mt-6 space-y-3">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest opacity-60">
                A few quick details (optional)
              </p>
              <div>
                <label
                  htmlFor="wait-relationship"
                  className="mb-1 block text-xs font-semibold opacity-75"
                >
                  How do you know {name.trim() || "them"}?
                </label>
                <select
                  id="wait-relationship"
                  value={waitRelationship}
                  onChange={(e) =>
                    setWaitRelationship(e.target.value as WaitCaptureRelationship | "")
                  }
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">—</option>
                  {WAIT_CAPTURE_RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel.charAt(0).toUpperCase() + rel.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="wait-location"
                  className="mb-1 block text-xs font-semibold opacity-75"
                >
                  Where will you celebrate?
                </label>
                <select
                  id="wait-location"
                  value={waitLocation}
                  onChange={(e) =>
                    setWaitLocation(e.target.value as WaitCaptureLocation | "")
                  }
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">—</option>
                  {WAIT_CAPTURE_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc.charAt(0).toUpperCase() + loc.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold opacity-90">
                <input
                  type="checkbox"
                  checked={waitYearReminder}
                  onChange={(e) => setWaitYearReminder(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-white/30 bg-white/5 accent-fuchsia-500"
                />
                Remind me next year?
              </label>
            </div>

            {/* "While you wait" panels — both collapsed by default so the
                main wait surface (template picker, preview, capture) stays
                visually dominant. Additive engagement, never blocking. */}
            <div className="mt-6 space-y-3">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest opacity-60">
                While you wait
              </p>

              {/* Share-message preview — same string that will land in
                  navigator.share() / wa.me/?text=, rendered as a faux chat
                  bubble. Live-updates as the user edits sender / name. */}
              <details
                open={previewPanelOpen}
                onToggle={(e) => setPreviewPanelOpen((e.target as HTMLDetailsElement).open)}
                className="overflow-hidden rounded-2xl border border-white/15 bg-white/5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold transition hover:bg-white/5">
                  <span>💬 Preview the share message</span>
                  <span aria-hidden className="text-base opacity-70">
                    {previewPanelOpen ? "−" : "+"}
                  </span>
                </summary>
                <div className="border-t border-white/10 bg-[#0f1318] px-4 py-4">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#005c4b] px-3 py-2 text-[13px] leading-snug text-white shadow-sm">
                    <div>
                      {senderName.trim()
                        ? `${senderName.trim()} made you a birthday song 🎂`
                        : `A birthday song for ${name.trim() || "you"} 🎂`}
                    </div>
                    <div className="mt-1 truncate text-[11px] opacity-80">
                      singmybirthday.com/share/…
                    </div>
                    <div className="mt-1 text-right text-[10px] opacity-70">
                      now ✓✓
                    </div>
                  </div>
                </div>
              </details>

              {/* Genre sample strip — short clip of a previously-generated
                  song in the chosen genre. Auto-mutes at 15s; pauses when
                  the user's real audio arrives or is played. Hidden when
                  the env doesn't expose a samples base (no upload yet). */}
              {sampleUrlForGenre(resolvedGenre ?? genre) && (
                <details
                  open={samplePanelOpen}
                  onToggle={(e) => setSamplePanelOpen((e.target as HTMLDetailsElement).open)}
                  className="overflow-hidden rounded-2xl border border-white/15 bg-white/5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold transition hover:bg-white/5">
                    <span>🎧 Hear a sample in this genre</span>
                    <span aria-hidden className="text-base opacity-70">
                      {samplePanelOpen ? "−" : "+"}
                    </span>
                  </summary>
                  <div className="border-t border-white/10 px-4 py-3">
                    <p className="mb-2 text-[11px] opacity-60">
                      15-second preview · auto-stops
                    </p>
                    <audio
                      ref={sampleAudioRef}
                      controls
                      preload="metadata"
                      src={sampleUrlForGenre(resolvedGenre ?? genre) ?? undefined}
                      className="w-full"
                      onTimeUpdate={(e) => {
                        const el = e.currentTarget;
                        if (el.currentTime >= SAMPLE_MAX_SECONDS) {
                          el.pause();
                          // Reset so the user can tap play again to hear the
                          // 15s preview from the start.
                          el.currentTime = 0;
                        }
                      }}
                      onError={() => {
                        // Sample 404'd or otherwise failed — close the panel
                        // so the user doesn't see a broken player. The next
                        // genre change re-evaluates the URL via the conditional.
                        setSamplePanelOpen(false);
                      }}
                    />
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </section>

      {errorMsg && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-2xl backdrop-blur-2xl`}>
          <h2 className="text-lg font-bold">Something went wrong</h2>
          <p className="mt-2 text-sm opacity-80">{errorMsg}</p>
          <button
            type="button"
            onClick={resetForRetry}
            className={`mt-4 rounded-2xl bg-gradient-to-r ${theme.accent} px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5`}
          >
            Try again
          </button>
        </section>
      )}

      {lyrics && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-2xl backdrop-blur-2xl`}>
          <h2 className="text-xl font-bold">Happy Birthday, {name}!</h2>
          <p className="text-sm opacity-70">
            {language} • {resolvedGenre ?? genre} • {lyrics.title}
          </p>

          {audioUrl ? (
            <div className="mt-4 space-y-3">
              <audio
                ref={songAudioRef}
                controls
                src={audioProxyUrl ?? audioUrl}
                className="w-full"
                onPlay={() => {
                  // User hit play on the real song — pause any genre sample
                  // that's still going from the wait panel.
                  try {
                    sampleAudioRef.current?.pause();
                  } catch {
                    // Ignore — pausing a paused element throws on some browsers.
                  }
                }}
                onTimeUpdate={(e) => {
                  // Free-preview gate: hold playback at PREVIEW_SECONDS and
                  // surface the unlock CTA. Client-side only for v1.
                  const el = e.currentTarget;
                  if (el.currentTime >= PREVIEW_SECONDS) {
                    el.pause();
                    el.currentTime = PREVIEW_SECONDS;
                    if (!previewEnded) setPreviewEnded(true);
                  }
                }}
                onSeeking={(e) => {
                  const el = e.currentTarget;
                  if (el.currentTime > PREVIEW_SECONDS) el.currentTime = PREVIEW_SECONDS;
                }}
              />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/90">
                🎁 Free preview · first {PREVIEW_SECONDS} seconds
              </p>

              {/* The buy moment — the preview hooked them; now unlock everything. */}
              <div className="rounded-3xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-amber-400/10 p-5">
                <p className="text-base font-extrabold">
                  {previewEnded ? `Loved it? Unlock ${name}'s full song 🎶` : `Unlock ${name}'s full song 🎶`}
                </p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">
                  Full one-minute song, MP3 download, a shareable video, and a photo
                  slideshow — keep it forever and send it to family.
                </p>
                <button
                  type="button"
                  onClick={unlockFullSong}
                  disabled={!shareUrl || unlocking}
                  className="mt-3 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {unlocking
                    ? "Opening secure checkout…"
                    : !shareUrl
                      ? "Preparing your song…"
                      : `Unlock the full song${shareTier ? ` · ${TIER_PRICE_LABEL[shareTier]}` : ""} →`}
                </button>
                <p className="mt-2 text-center text-[11px] opacity-60">
                  One-time payment · instant unlock · secure checkout by Stripe
                </p>
              </div>

              {/* Optional: add photos for a Ken-Burns slideshow set to the song.
                  Entirely optional — skipping is fine. The photos persist on the
                  share; the slideshow video renders after unlock. */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">📸 Add photos for a slideshow</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-70">
                      Optional — add up to {MAX_SLIDESHOW_PHOTOS} photos and we&apos;ll
                      turn them into a Ken-Burns video set to {name || "the"}&apos;s song
                      after you unlock.
                    </p>
                  </div>
                </div>

                {photoUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photoUrls.map((url, i) => (
                      <div
                        key={url}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5"
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
                  className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="mt-2 text-xs text-rose-300">{photoError}</p>
                )}
              </div>
            </div>
          ) : loadingMusic ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm opacity-80">
              🎵 {ready ? "Audio is ready." : longWaitHint ? "Music is still rendering — almost there..." : "Music is rendering..."}
            </div>
          ) : (
            <p className="mt-3 text-xs opacity-70">
              Edit any section below, then generate the music.
            </p>
          )}

          <div
            dir={language === "Arabic" ? "rtl" : "ltr"}
            style={language === "Hindi" ? { fontFamily: '"Noto Sans Devanagari", "Mangal", system-ui, sans-serif' } : undefined}
            className="mt-5 space-y-4"
          >
            {editableSections.map((section, idx) => (
              <div key={idx}>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide opacity-60">
                  [{section.tag}]
                </label>
                <textarea
                  value={section.text}
                  onChange={(e) => updateSectionText(idx, e.target.value)}
                  disabled={musicLocked}
                  rows={Math.max(2, section.text.split("\n").length)}
                  dir={language === "Arabic" ? "rtl" : "ltr"}
                  className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-relaxed outline-none transition focus:ring-2 focus:ring-purple-400 disabled:opacity-70 ${theme.input}`}
                />
              </div>
            ))}
          </div>

          {!audioUrl && (
            <div className="mt-5 space-y-3">
              {/* Commitment-point notice — Suno can't change words after the
                  melody is generated, so users must iterate on lyrics here.
                  Real feedback (Lemoni): loved the melody, wanted to edit the
                  words after the fact, which the API doesn't support. */}
              <div className="flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
                <span aria-hidden className="mt-px shrink-0">💡</span>
                <span>
                  Once you generate the music, the song&rsquo;s melody is locked
                  in. Tweak the lyrics now if anything&rsquo;s off — you can
                  re-write them as many times as you want.
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={generateMusicHandler}
                  disabled={loadingLyrics || loadingMusic}
                  className={`flex-1 rounded-2xl bg-gradient-to-r ${theme.accent} py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {loadingMusic ? "Generating music..." : "🎵 Generate music with these lyrics"}
                </button>
                <button
                  type="button"
                  onClick={generateLyricsHandler}
                  disabled={loadingLyrics || loadingMusic}
                  className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3.5 text-sm font-bold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loadingLyrics ? "Writing..." : "✍️ Re-write lyrics"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Send-this-song card only renders once the share artifact is ready
          (or an error fired). The audio + inline "wrapping it up" indicator
          above already keeps the user informed during the render window —
          this card slides in fresh, in sync with the second confetti burst. */}
      {audioUrl && lyrics && (shareUrl || shareError) && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-2xl backdrop-blur-2xl animate-fade-in`}>
          <h2 className="text-lg font-bold">🔗 Send this song</h2>
          <p className="mt-1 text-sm opacity-70">
            Your song is saved as a <span className="font-semibold">{TEMPLATE_LABELS[shareTemplate].name}</span> share — open the share page to send it.
          </p>

          {shareUrl && (
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={openShareUi}
                className="w-full rounded-2xl bg-brand py-4 text-base font-extrabold text-white shadow-2xl shadow-fuchsia-500/30 transition hover:-translate-y-1 hover:shadow-fuchsia-500/50"
              >
                🔗 Open share page
              </button>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm outline-none ${theme.input}`}
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className={`rounded-2xl bg-gradient-to-r ${theme.accent} px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5`}
                >
                  {copied ? "✓ Copied" : "Copy link"}
                </button>
              </div>

              {/* Optional promotional-use permission. Shown only after the song
                  is shareable, and never on minor-recipient flows. Prominent but
                  fully optional — it does not gate the share CTA above. */}
              {!recipientIsMinor && (
                <div className="mt-2 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-sm font-bold">💜 Proud of this one? Let it inspire others.</p>
                  <p className="mt-1 text-xs opacity-80">
                    Yes — Sing My Birthday can feature my song in highlights &amp; ads.
                    You can change your mind anytime; we&apos;ll never share private
                    details, and never for songs made for kids.
                  </p>
                  {promoResponded ? (
                    <p className="mt-3 text-sm font-semibold text-emerald-300">
                      {promoGranted
                        ? "Thank you! You can feature it 💜"
                        : "No problem — we won't feature it."}
                      {promoSaved && <span className="ml-1 opacity-70">Saved ✓</span>}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => submitPromoPermission(true)}
                        className={`rounded-2xl bg-gradient-to-r ${theme.accent} px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5`}
                      >
                        Yes, you can feature it
                      </button>
                      <button
                        type="button"
                        onClick={() => submitPromoPermission(false)}
                        className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
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
            <p className="mt-3 text-sm text-rose-300">{shareError}</p>
          )}
        </section>
      )}

      <footer className="relative z-20 mt-8 text-center text-xs opacity-70">
        Made with 💜 for birthday celebrations
      </footer>

      {showConfetti && <Confetti />}
    </main>
  );
}