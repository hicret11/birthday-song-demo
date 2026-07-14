"use client";
import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Classic({ song }: { song: SharedSong }) {
  return (
    <main className="grain relative min-h-screen overflow-hidden bg-cream text-ink">
      {/* Organic warm blobs, bleeding off the edges (anti-template). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Badge */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-sand bg-cream-soft px-5 py-2 text-sm font-semibold text-jade shadow-sm">
            🎬 Tonight&apos;s premiere
          </div>
        </div>

        <h1 className="text-center font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Happy Birthday,{" "}
          <span className="font-serif font-normal italic text-jade">{song.name}</span>
        </h1>

        <p className="mx-auto mt-4 max-w-md text-center text-lg leading-relaxed text-ink-soft">
          A song written &amp; sung just for you.
        </p>

        {/* Warm card holding the body */}
        <div className="grain relative mt-8 overflow-hidden rounded-2xl border border-sand bg-cream-soft p-6 shadow-sm">
          <SharedSongBody song={song} className="relative z-10 mt-2" />
        </div>
      </div>
    </main>
  );
}
