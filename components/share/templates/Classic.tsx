"use client";
import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Classic({ song }: { song: SharedSong }) {
  return (
    <main className="relative min-h-screen text-gray-800 overflow-hidden" style={{ backgroundColor: "#faf7f2" }}>

      {/* Subtle linen texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23000'/%3E%3Crect x='0' y='0' width='1' height='1' fill='%23fff'/%3E%3Crect x='2' y='2' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Soft radial glow center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,235,210,0.55) 0%, transparent 70%)",
        }}
      />

      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, #8b4513 20%, #8b4513 80%, transparent)" }}
      />

      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, #8b4513 20%, #8b4513 80%, transparent)" }}
      />

      {/* Corner ornaments — top left */}
      <svg className="absolute top-4 left-4 opacity-25 pointer-events-none" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M4 4 L4 28 M4 4 L28 4" stroke="#8b6914" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4 4 L18 18" stroke="#8b6914" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 3"/>
        <circle cx="4" cy="4" r="2.5" fill="#8b6914"/>
        <circle cx="28" cy="4" r="1.2" fill="#8b6914"/>
        <circle cx="4" cy="28" r="1.2" fill="#8b6914"/>
      </svg>

      {/* Corner ornaments — top right */}
      <svg className="absolute top-4 right-4 opacity-25 pointer-events-none" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M60 4 L60 28 M60 4 L36 4" stroke="#8b6914" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M60 4 L46 18" stroke="#8b6914" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 3"/>
        <circle cx="60" cy="4" r="2.5" fill="#8b6914"/>
        <circle cx="36" cy="4" r="1.2" fill="#8b6914"/>
        <circle cx="60" cy="28" r="1.2" fill="#8b6914"/>
      </svg>

      {/* Corner ornaments — bottom left */}
      <svg className="absolute bottom-4 left-4 opacity-25 pointer-events-none" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M4 60 L4 36 M4 60 L28 60" stroke="#8b6914" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4 60 L18 46" stroke="#8b6914" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 3"/>
        <circle cx="4" cy="60" r="2.5" fill="#8b6914"/>
        <circle cx="28" cy="60" r="1.2" fill="#8b6914"/>
        <circle cx="4" cy="36" r="1.2" fill="#8b6914"/>
      </svg>

      {/* Corner ornaments — bottom right */}
      <svg className="absolute bottom-4 right-4 opacity-25 pointer-events-none" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M60 60 L60 36 M60 60 L36 60" stroke="#8b6914" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M60 60 L46 46" stroke="#8b6914" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 3"/>
        <circle cx="60" cy="60" r="2.5" fill="#8b6914"/>
        <circle cx="36" cy="60" r="1.2" fill="#8b6914"/>
        <circle cx="60" cy="36" r="1.2" fill="#8b6914"/>
      </svg>

      {/* Faint horizontal rule lines for paper feel */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 47px, rgba(180,150,90,0.06) 48px)",
      }} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-white/10 backdrop-blur-sm px-5 py-2 text-sm font-semibold text-[#8b4513] shadow-lg border border-[#8b4513]/20">
            ✨ It's Your Special Day!
          </div>
        </div>

        {/* Small golden divider above title */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#8b4513]" />
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-60">
            <path d="M7 1 L8.2 5.5 L13 5.5 L9.2 8.2 L10.5 13 L7 10 L3.5 13 L4.8 8.2 L1 5.5 L5.8 5.5 Z" fill="#8b4513"/>
          </svg>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#8b4513]" />
        </div>

        <h1 className="text-center text-4xl font-extrabold tracking-tight text-gray-800" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          Happy Birthday, {song.name}!
        </h1>

        {/* Small golden divider below title */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <div className="h-px w-24 bg-gradient-to-r from-transparent to-[#8b4513]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#8b4513] opacity-70" />
          <div className="h-px w-24 bg-gradient-to-l from-transparent to-[#8b4513]" />
        </div>

        <SharedSongBody song={song} className="mt-8" />
      </div>
    </main>
  );
}