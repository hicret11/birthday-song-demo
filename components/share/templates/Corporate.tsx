"use client";

import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Corporate({ song }: { song: SharedSong }) {
  return (
    <main className="grain relative min-h-screen overflow-hidden bg-cream text-ink">
      {/* Restrained warm wash — a single soft accent, kept low-key */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.35),transparent_66%)] blur-2xl"
      />

      {/* Top accent rule — single jade line */}
      <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-jade" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Eyebrow / badge — understated */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-sand bg-cream-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-jade shadow-sm">
            Best Wishes
          </div>
        </div>

        {/* Short accent underline above the headline */}
        <div className="mb-6 flex items-center justify-center">
          <div className="h-[3px] w-12 rounded-full bg-jade" />
        </div>

        <h1 className="text-center font-display text-4xl font-extrabold tracking-tight text-ink">
          Happy Birthday, {song.name}
        </h1>

        <p className="mt-4 text-center text-sm text-ink-soft">
          A personalized birthday song, made just for you.
        </p>

        {/* Clean card — crisp border, business-appropriate */}
        <div className="mt-10 rounded-2xl border border-sand bg-cream-soft p-6 shadow-sm">
          <SharedSongBody song={song} className="mt-2" />
        </div>
      </div>
    </main>
  );
}
