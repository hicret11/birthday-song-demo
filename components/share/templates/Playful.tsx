import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Playful({ song }: { song: SharedSong }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#ff8a8a] via-[#ffb86b] to-[#ff4faf] text-gray-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-center text-4xl font-extrabold">
          🎉 Happy Birthday, {song.name}! 🎂
        </h1>
        <SharedSongBody song={song} className="mt-8" />
      </div>
    </main>
  );
}
