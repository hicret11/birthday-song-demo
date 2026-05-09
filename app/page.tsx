"use client";

import { useEffect, useRef, useState } from "react";

type ThemeKey =
  | "dark"
  | "light"
  | "party"
  | "pastel"
  | "luxury"
  | "confetti"
  | "balloons"
  | "bubbles";

type TabKey = "basic" | "advanced";

const genres = [
  "🎤 Pop",
  "🎷 R&B",
  "🎸 Rock",
  "🎹 Jazz",
  "🎧 Hip-Hop",
  "🎛️ Electronic",
  "🎲 Surprise Me",
];

const languages = ["English", "Turkish", "Spanish", "French", "Arabic", "Hindi"];

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
  const [language, setLanguage] = useState("English");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<null | (() => void)>(null);

  const theme = themes[themeKey];
  const canGenerate = name.trim() && genre;

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

  function generateSong() {
    if (!canGenerate) return;

    setLoading(true);
    setReady(false);
    setProgress(0);

    let value = 0;
    const interval = setInterval(() => {
      value += 10;
      setProgress(value);

      if (value >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
          setReady(true);
        }, 400);
      }
    }, 250);
  }

  function runConfetti(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};

    const colors = ["#f43f5e", "#a855f7", "#3b82f6", "#facc15", "#34d399", "#fb923c"];
    const pieces = Array.from({ length: 160 }, () => ({
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
        ctx.globalAlpha = 0.75;
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
    const balloons = Array.from({ length: 24 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * canvas.height,
      r: Math.random() * 28 + 18,
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
        ctx.ellipse(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.18, b.r * 0.24, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
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

    const bubbles = Array.from({ length: 44 }, () => ({
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
        ctx.globalAlpha = 0.28;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fill();

        ctx.restore();
      });

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }

  function BasicFields() {
    return (
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-bold">
            👤 Who’s the birthday star?
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter their name..."
            className={`w-full rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">
            🌍 Choose language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`w-full rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
          >
            {languages.map((lang) => (
              <option key={lang} className="text-gray-900">
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold">
            🎵 Pick a genre
          </label>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {genres
              .filter((item) => !item.includes("Surprise"))
              .map((item) => (
                <button
                  key={item}
                  onClick={() => setGenre(item)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold transition hover:-translate-y-1 ${
                    genre === item
                      ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                      : "border-white/15 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}

            <button
              onClick={() => setGenre("🎲 Surprise Me")}
              className={`col-span-2 md:col-span-3 rounded-2xl border border-dashed px-4 py-4 text-base font-extrabold transition hover:-translate-y-1 ${
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
  }

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-br ${theme.pageBg} ${theme.text} px-4 py-8 transition-all duration-700`}
    >
      <style>{`
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
        .float-one {
          animation: floatOne 9s ease-in-out infinite;
        }
        .float-two {
          animation: floatTwo 12s ease-in-out infinite;
        }
      `}</style>

      <div className={`absolute inset-0 bg-gradient-to-br ${theme.pageBg} moving-bg`} />

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[1]" />

      {theme.effect === "emoji" && (
        <div className="pointer-events-none absolute inset-0 z-[2]">
          {theme.emojis.map((emoji, index) => {
            const positions = [
              ["8%", "5%"],
              ["14%", "82%"],
              ["28%", "9%"],
              ["35%", "88%"],
              ["54%", "6%"],
              ["62%", "86%"],
              ["78%", "12%"],
              ["82%", "76%"],
              ["20%", "23%"],
              ["72%", "28%"],
              ["18%", "65%"],
              ["50%", "70%"],
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

      <button
        onClick={() => setThemeOpen(!themeOpen)}
        className="fixed right-5 top-5 z-50 rounded-2xl border border-white/20 bg-white/15 px-5 py-3 font-bold shadow-2xl backdrop-blur-xl"
      >
        🎨 Theme
      </button>

      {themeOpen && (
        <div className="fixed right-5 top-20 z-50 max-h-[80vh] w-72 overflow-y-auto rounded-3xl border border-white/20 bg-black/70 p-4 text-white shadow-2xl backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Choose Theme</h3>
            <button onClick={() => setThemeOpen(false)}>✕</button>
          </div>

          <div className="space-y-3">
            {Object.entries(themes).map(([key, item]) => (
              <button
                key={key}
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
                <div className={`h-12 w-16 rounded-xl bg-gradient-to-br ${item.pageBg}`} />
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

      <header className="relative z-10 mx-auto mb-8 max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold backdrop-blur">
          ✨ AI-Powered
        </div>

        <h1
          className={`bg-gradient-to-r ${theme.title} bg-clip-text pb-4 text-5xl font-extrabold leading-[1.18] text-transparent md:text-7xl`}
        >
          Birthday Song Generator
        </h1>

        <p className={`text-lg ${theme.sub}`}>
          Create a personalized birthday song in seconds
        </p>
      </header>

      <section
        className={`relative z-10 mx-auto max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-2xl backdrop-blur-2xl md:p-8`}
      >
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setTab("basic")}
            className={`flex-1 rounded-2xl border py-3 font-bold transition ${
              tab === "basic"
                ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                : "border-white/15 bg-white/5 opacity-75"
            }`}
          >
            ♪ Basic
          </button>

          <button
            onClick={() => setTab("advanced")}
            className={`flex-1 rounded-2xl border py-3 font-bold transition ${
              tab === "advanced"
                ? `border-transparent bg-gradient-to-r ${theme.accent} text-white shadow-lg`
                : "border-white/15 bg-white/5 opacity-75"
            }`}
          >
            ⚙ Advanced
          </button>
        </div>

        {tab === "basic" && <BasicFields />}

        {tab === "advanced" && (
          <div className="space-y-5">
            <BasicFields />

            <div className="border-t border-white/10 pt-5">
              <p className="mb-4 text-sm font-bold opacity-80">
                ✨ Advanced personalization
              </p>

              <div className="space-y-4">
                <input
                  placeholder="Who is this person to you?"
                  className={`w-full rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />

                <textarea
                  placeholder="What is a special memory you share?"
                  rows={2}
                  className={`w-full resize-none rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />

                <input
                  placeholder="How long have you known this person for?"
                  className={`w-full rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />

                <input
                  placeholder="How old are they turning?"
                  className={`w-full rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />

                <input
                  placeholder="What is their profession?"
                  className={`w-full rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />

                <textarea
                  placeholder="Anything else you want to add?"
                  rows={3}
                  className={`w-full resize-none rounded-2xl border px-4 py-4 outline-none transition focus:ring-2 focus:ring-purple-400 ${theme.input}`}
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={generateSong}
          disabled={!canGenerate || loading}
          className={`mt-6 w-full rounded-2xl bg-gradient-to-r ${theme.accent} py-5 text-lg font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {loading ? "Generating..." : "✨ Generate Song"}
        </button>

        {loading && (
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs opacity-70">
              <span>Composing your song...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full bg-gradient-to-r ${theme.accent} transition-all`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {ready && (
        <section
          className={`relative z-10 mx-auto mt-6 max-w-xl rounded-[2rem] border ${theme.card} p-6 shadow-2xl backdrop-blur-2xl`}
        >
          <div className="mb-5 flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.accent} text-2xl`}
            >
              🎂
            </div>

            <div>
              <h2 className="text-xl font-bold">Happy Birthday, {name}!</h2>
              <p className="text-sm opacity-70">
                {language} • {genre} • Frontend demo
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl bg-white/10 p-4">
            <div className="flex items-center gap-4">
              <button
                className={`h-12 w-12 rounded-full bg-gradient-to-r ${theme.accent}`}
              >
                ▶
              </button>

              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className={`h-full w-1/3 bg-gradient-to-r ${theme.accent}`}
                  />
                </div>

                <div className="mt-1 flex justify-between text-xs opacity-60">
                  <span>0:24</span>
                  <span>3:24</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 rounded-xl border border-white/20 py-3 font-bold hover:bg-white/10">
              Download
            </button>
            <button className="flex-1 rounded-xl border border-white/20 py-3 font-bold hover:bg-white/10">
              Share
            </button>
          </div>
        </section>
      )}

      <footer className="relative z-10 mt-8 text-center text-xs opacity-70">
        Made with 💜 for birthday celebrations
      </footer>
    </main>
  );
}