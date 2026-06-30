"use client";

import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Corporate({ song }: { song: SharedSong }) {
  return (
    <main
      className="relative min-h-screen overflow-hidden text-slate-100"
      style={{ background: "linear-gradient(165deg, #0b1220 0%, #131c2e 55%, #1b2538 100%)" }}
    >
      {/* Restrained accent glow — a single brand-pink wash, kept low-key */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(236,72,153,0.12) 0%, transparent 60%)",
        }}
      />

      {/* Faint blueprint grid for a crisp, professional feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[linear-gradient(to_right,#ffffff14_1px,transparent_1px),linear-gradient(to_bottom,#ffffff14_1px,transparent_1px)] bg-[size:48px_48px]"
      />

      {/* Top accent rule — single brand-pink line, no gradient flourish */}
      <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none bg-[#ec4899]/70" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Eyebrow / badge — understated */}
        <div className="flex justify-center mb-6">
          <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Best Wishes
          </div>
        </div>

        {/* Short accent underline above the headline */}
        <div className="flex items-center justify-center mb-6">
          <div className="h-[3px] w-12 rounded-full bg-[#ec4899]" />
        </div>

        <h1
          className="text-center text-4xl font-bold tracking-tight text-white"
          style={{ fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif", letterSpacing: "-0.01em" }}
        >
          Happy Birthday, {song.name}
        </h1>

        <p className="mt-4 text-center text-sm text-slate-400">
          A personalized birthday song, made just for you.
        </p>

        {/* Clean card — crisp border, minimal blur, business-appropriate */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/30 backdrop-blur-sm">
          <SharedSongBody song={song} className="mt-2" />
        </div>
      </div>
    </main>
  );
}
