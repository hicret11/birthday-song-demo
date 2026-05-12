import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Neon({ song }: { song: SharedSong }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-center text-4xl font-extrabold bg-gradient-to-r from-pink-400 via-purple-300 to-blue-300 bg-clip-text text-transparent">
          Happy Birthday, {song.name}!
        </h1>
        <SharedSongBody song={song} className="mt-8" />
      </div>
    </main>
  );
}
