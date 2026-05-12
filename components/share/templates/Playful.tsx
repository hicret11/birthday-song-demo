"use client";

import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Playful({ song }: { song: SharedSong }) {
  const stars = [
    { top: "8%", left: "18%", size: 10, delay: "0s", class: "wiggle" },
    { top: "5%", left: "55%", size: 8, delay: "0.4s", class: "wiggle" },
    { top: "12%", left: "72%", size: 12, delay: "0.8s", class: "wiggle" },
    { top: "20%", left: "38%", size: 7, delay: "1.1s", class: "wiggle" },
    { top: "22%", left: "85%", size: 9, delay: "0.2s", class: "wiggle" },
    { top: "30%", left: "10%", size: 11, delay: "1.4s", class: "wiggle" },
    { top: "35%", left: "62%", size: 8, delay: "0.6s", class: "wiggle" },
    { top: "38%", left: "28%", size: 6, delay: "1.8s", class: "wiggle" },
    { top: "45%", left: "78%", size: 10, delay: "0.9s", class: "wiggle" },
    { top: "50%", left: "48%", size: 7, delay: "1.3s", class: "wiggle" },
    { top: "55%", left: "15%", size: 9, delay: "0.5s", class: "wiggle" },
    { top: "60%", left: "90%", size: 8, delay: "1.6s", class: "wiggle" },
    { top: "65%", left: "35%", size: 11, delay: "0.3s", class: "wiggle" },
    { top: "70%", left: "68%", size: 7, delay: "1.0s", class: "wiggle" },
    { top: "75%", left: "5%", size: 9, delay: "0.7s", class: "wiggle" },
    { top: "78%", left: "52%", size: 6, delay: "1.5s", class: "wiggle" },
    { top: "82%", left: "82%", size: 10, delay: "0.2s", class: "wiggle" },
    { top: "88%", left: "22%", size: 8, delay: "1.2s", class: "wiggle" },
    { top: "92%", left: "42%", size: 7, delay: "0.8s", class: "wiggle" },
    { top: "15%", left: "92%", size: 6, delay: "1.7s", class: "wiggle" },
    { top: "42%", left: "3%", size: 8, delay: "0.4s", class: "wiggle" },
    { top: "58%", left: "58%", size: 9, delay: "1.1s", class: "wiggle" },
    { top: "25%", left: "48%", size: 6, delay: "0.9s", class: "wiggle" },
    { top: "68%", left: "44%", size: 7, delay: "0.6s", class: "wiggle" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden text-gray-900" style={{ background: "linear-gradient(135deg, #ff8a8a 0%, #ffb86b 50%, #ff4faf 100%)" }}>
      <style>{`
        @keyframes floatBalloon {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50% { transform: translateY(-16px) rotate(3deg); }
        }
        @keyframes floatBalloon2 {
          0%, 100% { transform: translateY(0px) rotate(4deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
        @keyframes floatBalloon3 {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-18px) rotate(4deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-6deg) scale(1); opacity: 0.7; }
          50% { transform: rotate(6deg) scale(1.15); opacity: 1; }
        }
        .balloon1 { animation: floatBalloon 5s ease-in-out infinite; }
        .balloon2 { animation: floatBalloon2 6.5s ease-in-out infinite; }
        .balloon3 { animation: floatBalloon3 4.8s ease-in-out infinite; }
        .balloon4 { animation: floatBalloon 7s ease-in-out infinite; }
        .balloon5 { animation: floatBalloon2 5.5s ease-in-out infinite; }
        .wiggle { animation: wiggle 3s ease-in-out infinite; }
        .spin-slow { animation: spin 12s linear infinite; }
      `}</style>

      {/* Soft overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,255,255,0.18) 0%, transparent 70%)" }}
      />

      {/* Polka dots */}
      <div className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* ── WHITE STARS scattered ── */}
      {stars.map((s, i) => (
        <svg
          key={i}
          className="absolute pointer-events-none wiggle"
          style={{ top: s.top, left: s.left, animationDelay: s.delay, opacity: 0.75 }}
          width={s.size} height={s.size} viewBox="0 0 20 20"
        >
          <path d="M10 1 L12 7.5 L19 7.5 L13.5 12 L15.5 19 L10 15 L4.5 19 L6.5 12 L1 7.5 L8 7.5 Z" fill="white"/>
        </svg>
      ))}

      {/* ── BALLOONS ── */}
      <svg className="absolute top-6 left-8 pointer-events-none balloon1" width="52" height="80" viewBox="0 0 52 80" fill="none">
        <ellipse cx="26" cy="28" rx="22" ry="26" fill="#ff4f4f" opacity="0.85"/>
        <ellipse cx="18" cy="18" rx="6" ry="5" fill="white" opacity="0.25" transform="rotate(-20 18 18)"/>
        <path d="M26 54 Q28 60 25 66 Q23 72 26 78" stroke="#ff4f4f" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M24 54 L26 54 L28 54" stroke="#cc3333" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>

      <svg className="absolute top-2 left-24 pointer-events-none balloon2" width="44" height="70" viewBox="0 0 44 70" fill="none">
        <ellipse cx="22" cy="24" rx="18" ry="22" fill="#ffd700" opacity="0.9"/>
        <ellipse cx="15" cy="15" rx="5" ry="4" fill="white" opacity="0.3" transform="rotate(-20 15 15)"/>
        <path d="M22 46 Q24 52 21 58 Q19 63 22 68" stroke="#ffd700" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M20 46 L22 46 L24 46" stroke="#ccaa00" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>

      <svg className="absolute top-4 right-10 pointer-events-none balloon3" width="52" height="80" viewBox="0 0 52 80" fill="none">
        <ellipse cx="26" cy="28" rx="22" ry="26" fill="#c084fc" opacity="0.85"/>
        <ellipse cx="18" cy="18" rx="6" ry="5" fill="white" opacity="0.25" transform="rotate(-20 18 18)"/>
        <path d="M26 54 Q28 60 25 66 Q23 72 26 78" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M24 54 L26 54 L28 54" stroke="#9933cc" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>

      <svg className="absolute top-10 right-28 pointer-events-none balloon4" width="44" height="70" viewBox="0 0 44 70" fill="none">
        <ellipse cx="22" cy="24" rx="18" ry="22" fill="#60c8ff" opacity="0.9"/>
        <ellipse cx="15" cy="15" rx="5" ry="4" fill="white" opacity="0.3" transform="rotate(-20 15 15)"/>
        <path d="M22 46 Q24 52 21 58 Q19 63 22 68" stroke="#60c8ff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M20 46 L22 46 L24 46" stroke="#2299cc" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>

      <svg className="absolute bottom-10 left-6 pointer-events-none balloon5" width="48" height="74" viewBox="0 0 48 74" fill="none">
        <ellipse cx="24" cy="26" rx="20" ry="24" fill="#4ade80" opacity="0.85"/>
        <ellipse cx="16" cy="16" rx="5" ry="4" fill="white" opacity="0.25" transform="rotate(-20 16 16)"/>
        <path d="M24 50 Q26 56 23 62 Q21 67 24 72" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M22 50 L24 50 L26 50" stroke="#22aa55" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>

      <svg className="absolute bottom-8 right-8 pointer-events-none balloon2" width="48" height="74" viewBox="0 0 48 74" fill="none">
        <ellipse cx="24" cy="26" rx="20" ry="24" fill="#fb923c" opacity="0.85"/>
        <ellipse cx="16" cy="16" rx="5" ry="4" fill="white" opacity="0.25" transform="rotate(-20 16 16)"/>
        <path d="M24 50 Q26 56 23 62 Q21 67 24 72" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M22 50 L24 50 L26 50" stroke="#cc5500" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>

      {/* Spinning pinwheel — left */}
      <svg className="absolute top-1/2 left-4 pointer-events-none spin-slow opacity-30" width="36" height="36" viewBox="0 0 36 36">
        <path d="M18 18 Q18 4 26 4 Q30 4 30 10 Q30 18 18 18 Z" fill="#ff4f4f"/>
        <path d="M18 18 Q32 18 32 26 Q32 30 26 30 Q18 30 18 18 Z" fill="#ffd700"/>
        <path d="M18 18 Q18 32 10 32 Q6 32 6 26 Q6 18 18 18 Z" fill="#60c8ff"/>
        <path d="M18 18 Q4 18 4 10 Q4 6 10 6 Q18 6 18 18 Z" fill="#4ade80"/>
        <circle cx="18" cy="18" r="3" fill="white"/>
      </svg>

      {/* Spinning pinwheel — right bottom */}
      <svg className="absolute bottom-16 right-4 pointer-events-none spin-slow opacity-25" width="30" height="30" viewBox="0 0 36 36" style={{ animationDirection: "reverse" }}>
        <path d="M18 18 Q18 4 26 4 Q30 4 30 10 Q30 18 18 18 Z" fill="#c084fc"/>
        <path d="M18 18 Q32 18 32 26 Q32 30 26 30 Q18 30 18 18 Z" fill="#fb923c"/>
        <path d="M18 18 Q18 32 10 32 Q6 32 6 26 Q6 18 18 18 Z" fill="#ff4f4f"/>
        <path d="M18 18 Q4 18 4 10 Q4 6 10 6 Q18 6 18 18 Z" fill="#ffd700"/>
        <circle cx="18" cy="18" r="3" fill="white"/>
      </svg>

      {/* Streamers */}
      <svg className="absolute top-0 left-1/4 pointer-events-none opacity-30" width="4" height="200" viewBox="0 0 4 200">
        <path d="M2 0 Q4 25 2 50 Q0 75 2 100 Q4 125 2 150 Q0 175 2 200" stroke="#fff" strokeWidth="2" fill="none" strokeDasharray="4 6"/>
      </svg>
      <svg className="absolute top-0 right-1/4 pointer-events-none opacity-25" width="4" height="160" viewBox="0 0 4 160">
        <path d="M2 0 Q4 20 2 40 Q0 60 2 80 Q4 100 2 120 Q0 140 2 160" stroke="#ffd700" strokeWidth="2" fill="none" strokeDasharray="4 6"/>
      </svg>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-white/30 backdrop-blur-sm px-5 py-2 text-sm font-bold text-white shadow-lg border border-white/40">
            🎉 It's Your Special Day!
          </div>
        </div>

        <h1 className="text-center text-5xl font-extrabold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          🎂 Happy Birthday,<br />{song.name}! 🎈
        </h1>

        <div className="mt-10 rounded-3xl border border-white/40 bg-white/25 p-6 shadow-xl backdrop-blur-md">
          <SharedSongBody song={song} className="mt-2" />
        </div>
      </div>
    </main>
  );
}