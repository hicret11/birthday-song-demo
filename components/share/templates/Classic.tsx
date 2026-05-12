import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Classic({ song }: { song: SharedSong }) {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-center text-4xl font-extrabold">
          Happy Birthday, {song.name}!
        </h1>
        <SharedSongBody song={song} className="mt-8" />
      </div>
    </main>
  );
}
