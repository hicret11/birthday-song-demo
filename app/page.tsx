"use client";

import { useEffect, useRef, useState } from "react";
import type {
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
} from "@/lib/api-types";
import { SHARE_TEMPLATES } from "@/lib/api-types";

type EditableSection = { tag: LyricSectionTag; text: string };

const TEMPLATE_LABELS: Record<ShareTemplate, { name: string; desc: string }> = {
  classic: { name: "Classic", desc: "Clean & timeless" },
  neon: { name: "Neon", desc: "Vibrant & glowing" },
  elegant: { name: "Elegant", desc: "Refined & golden" },
  playful: { name: "Playful", desc: "Fun & colorful" },
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

export default function Home() {
  const [tab, setTab] = useState<TabKey>("basic");
  const [themeKey, setThemeKey] = useState<ThemeKey>("dark");
  const [themeOpen, setThemeOpen] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("English");
  const [genre, setGenre] = useState("");
  const [relationship, setRelationship] = useState("");
  const [age, setAge] = useState("");
  const [profession, setProfession] = useState("");
  const [memory, setMemory] = useState("");
  const [extras, setExtras] = useState("");
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [editableSections, setEditableSections] = useState<EditableSection[]>([]);
  const [resolvedGenre, setResolvedGenre] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [longWaitHint, setLongWaitHint] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [shareTemplate, setShareTemplate] = useState<ShareTemplate>("classic");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<null | (() => void)>(null);
  const completeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = themes[themeKey];
  const canGenerate = name.trim() && genre;
  const musicLocked = loadingMusic || jobId !== null || audioUrl !== null;

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
      age: age.trim() || undefined,
      profession: profession.trim() || undefined,
      memory: memory.trim() || undefined,
      extras: extras.trim() || undefined,
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

    const payload: GenerateMusicRequest = {
      lyrics: { ...lyrics, sections: editedSections },
      name: name.trim(),
      genre: resolvedGenre ?? genre,
      language,
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

    const payload: ShareCreateRequest = {
      name: name.trim(),
      language,
      genre: resolvedGenre ?? genre,
      lyrics: editedLyrics,
      audioUrl,
      template: shareTemplate,
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
    } catch {
      setShareError("Couldn't reach the server. Please try again.");
    } finally {
      setCreatingShare(false);
    }
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

      <header className="relative z-20 mx-auto mb-6 max-w-5xl text-center">
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
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="How old are they turning?"
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

        <button
          type="button"
          onClick={generateLyricsHandler}
          disabled={!canGenerate || loadingLyrics || loadingMusic}
          className={`mt-6 w-full rounded-2xl bg-gradient-to-r ${theme.accent} py-4 text-[clamp(15px,3vw,18px)] font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {loadingLyrics ? "Writing lyrics..." : "✨ Write Lyrics"}
        </button>

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
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs opacity-70">
              <span>
                {audioUrl
                  ? "Done"
                  : elapsedMs < 15_000
                    ? "Sending to studio..."
                    : elapsedMs < 45_000
                      ? "Composing music..."
                      : elapsedMs < 90_000
                        ? "Adding vocals..."
                        : "Mastering, almost ready..."}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className={`h-full bg-gradient-to-r ${theme.accent} transition-all`} style={{ width: `${progress}%` }} />
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
            <div className="mt-4 space-y-2">
              <audio controls src={audioUrl} className="w-full" />
              <a
                href={audioUrl}
                download
                className="inline-block text-xs opacity-70 underline-offset-2 hover:underline"
              >
                Download audio
              </a>
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
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={generateMusicHandler}
                disabled={loadingLyrics || loadingMusic}
                className={`flex-1 rounded-2xl bg-gradient-to-r ${theme.accent} py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {loadingMusic ? "Generating music..." : "🎵 Generate music"}
              </button>
              <button
                type="button"
                onClick={generateLyricsHandler}
                disabled={loadingLyrics || loadingMusic}
                className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3.5 text-sm font-bold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingLyrics ? "Writing..." : "🔄 Regenerate lyrics"}
              </button>
            </div>
          )}
        </section>
      )}

      {audioUrl && lyrics && (
        <section className={`relative z-20 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-2xl backdrop-blur-2xl`}>
          <h2 className="text-lg font-bold">🔗 Share this song</h2>
          <p className="mt-1 text-sm opacity-70">Pick a template and create a link to send.</p>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
            {SHARE_TEMPLATES.map((key) => {
              const meta = TEMPLATE_LABELS[key];
              const selected = shareTemplate === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setShareTemplate(key)}
                  disabled={creatingShare}
                  className={`rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                      : "border-white/15 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="text-sm font-bold">{meta.name}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">{meta.desc}</p>
                </button>
              );
            })}
          </div>

          {!shareUrl && (
            <button
              type="button"
              onClick={createShareLink}
              disabled={creatingShare}
              className={`mt-5 w-full rounded-2xl bg-gradient-to-r ${theme.accent} py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {creatingShare ? "Creating link..." : "🔗 Create share link"}
            </button>
          )}

          {shareUrl && (
            <div className="mt-5 space-y-3">
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
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs opacity-70 underline-offset-2 hover:underline"
              >
                Open share page ↗
              </a>
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
    </main>
  );
}