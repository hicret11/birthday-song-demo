import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Elegant({ song }: { song: SharedSong }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#030303] via-[#14100a] to-[#3b2700] text-yellow-50">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-center text-4xl font-serif font-extrabold bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-100 bg-clip-text text-transparent">
          Happy Birthday, {song.name}
        </h1>
        <SharedSongBody song={song} className="mt-8" />
      </div>
    </main>
  );
}
