"use client";
import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Classic({ song }: { song: SharedSong }) {
  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "linear-gradient(160deg, #1a0b2e 0%, #2d1248 45%, #3a1b1f 100%)" }}
    >
      {/* Brand gradient aurora — pink → purple → amber, the Sing My Birthday palette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 18%, rgba(236,72,153,0.35) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 15% 85%, rgba(168,85,247,0.28) 0%, transparent 62%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 88% 78%, rgba(245,158,11,0.22) 0%, transparent 60%)",
        }}
      />

      {/* Subtle grain so the dark fields don't look flat */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23000'/%3E%3Crect x='0' y='0' width='1' height='1' fill='%23fff'/%3E%3Crect x='2' y='2' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Top brand-gradient hairline */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
        style={{ background: "linear-gradient(to right, #ec4899, #a855f7 50%, #f59e0b)" }}
      />
      {/* Bottom brand-gradient hairline */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none"
        style={{ background: "linear-gradient(to right, #f59e0b, #a855f7 50%, #ec4899)" }}
      />

      {/* Soft floating confetti sparks in brand hues */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" preserveAspectRatio="xMidYMid slice">
        {[
          [10, 14, "#ec4899"], [22, 70, "#a855f7"], [34, 30, "#f59e0b"], [46, 85, "#ec4899"],
          [58, 22, "#a855f7"], [70, 60, "#f59e0b"], [82, 40, "#ec4899"], [90, 80, "#a855f7"],
          [16, 50, "#f59e0b"], [64, 12, "#ec4899"], [38, 64, "#a855f7"], [88, 18, "#f59e0b"],
        ].map(([cx, cy, color], i) => (
          <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={i % 3 === 0 ? "2" : "1.2"} fill={color as string} />
        ))}
      </svg>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-pink-100 shadow-lg backdrop-blur-sm">
            ✨ It's Your Special Day!
          </div>
        </div>

        {/* Divider above title */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-pink-400" />
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-90">
            <path d="M7 1 L8.2 5.5 L13 5.5 L9.2 8.2 L10.5 13 L7 10 L3.5 13 L4.8 8.2 L1 5.5 L5.8 5.5 Z" fill="#f59e0b" />
          </svg>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400" />
        </div>

        <h1
          className="text-center text-4xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(236,72,153,0.35)]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Happy Birthday, {song.name}!
        </h1>

        {/* Divider below title */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <div className="h-px w-24 bg-gradient-to-r from-transparent to-purple-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-300 opacity-90" />
          <div className="h-px w-24 bg-gradient-to-l from-transparent to-pink-400" />
        </div>

        {/* Glass card holding the body — matches the app's dark/glass convention */}
        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_rgba(168,85,247,0.15)] backdrop-blur-xl">
          <SharedSongBody song={song} className="mt-2" />
        </div>
      </div>
    </main>
  );
}
