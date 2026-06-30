import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShareTemplateView } from "@/components/share/templates";
import { loadSharedSong } from "@/lib/share";
import TrackShareView from "./TrackShareView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const song = await loadSharedSong(id).catch(() => null);
  if (!song) return { title: "Birthday song" };
  return {
    title: `Happy Birthday, ${song.name}!`,
    description: `A personalized ${song.genre} birthday song for ${song.name}.`,
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { unlocked: unlockedParam } = await searchParams;
  const song = await loadSharedSong(id);
  if (!song) notFound();

  const justUnlocked = !!song.unlocked && unlockedParam === "1";

  return (
    <>
      <TrackShareView
        venue_slug={song.venueSlug ?? null}
        share_id={song.id}
        recipient_name={song.name}
        language={song.language}
        genre={song.genre}
      />
      {justUnlocked && (
        <div className="fixed inset-x-0 top-0 z-50 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-4 py-3 text-center text-sm font-extrabold text-white shadow-lg">
          🎉 Unlocked! The full song is yours.
        </div>
      )}
      <ShareTemplateView song={song} />
    </>
  );
}
