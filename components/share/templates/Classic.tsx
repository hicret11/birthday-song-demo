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

        {/* Warm-gradient album-art tile — the gift reveal */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-3 -z-10 rounded-[1.9rem] bg-warm-gradient opacity-35 blur-2xl" />
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-warm-gradient text-white shadow-lg">
              {/* Stroked (not filled) so the note reads as a clean music note,
                  not a solid blob — the path is open and would fill oddly. */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
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
