"use client";

import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Elegant({ song }: { song: SharedSong }) {
  return (
    <main className="grain relative min-h-screen overflow-hidden bg-cream text-ink">
      {/* Soft warm blobs for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-20 z-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.28),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-20 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.32),transparent_66%)] blur-2xl"
      />

      {/* Thin gold top rule */}
      <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-gold/70" />
      {/* Thin gold bottom rule */}
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-gold/70" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Badge */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-sand bg-cream-soft px-5 py-2 text-sm font-semibold text-gold shadow-sm">
            ✨ It&apos;s Your Special Day!
          </div>
        </div>

        {/* Ornamental gold divider */}
        <div className="mb-7 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold" />
          <svg width="32" height="14" viewBox="0 0 32 14" fill="none" aria-hidden>
            <path d="M16 1 L19 6 L25 6 L20.5 9.5 L22.5 14 L16 10.5 L9.5 14 L11.5 9.5 L7 6 L13 6 Z" fill="currentColor" className="text-gold" opacity="0.85" />
          </svg>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold" />
        </div>

        <h1 className="text-center font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Happy Birthday,
          <br />
          <span className="font-serif font-normal italic text-gold">{song.name}</span>
        </h1>

        {/* Ornamental gold divider */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="h-px w-16 bg-gold/60" />
          <div className="h-1.5 w-1.5 rounded-full bg-gold/80" />
          <div className="h-px w-16 bg-gold/60" />
        </div>

        {/* Warm card holding the body */}
        <div className="mt-10 rounded-2xl border border-sand bg-cream-soft p-6 shadow-sm">
          <SharedSongBody song={song} className="mt-2" />
        </div>
      </div>
    </main>
  );
}
