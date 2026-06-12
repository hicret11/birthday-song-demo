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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song = await loadSharedSong(id);
  if (!song) notFound();

  return (
    <>
      <TrackShareView
        venue_slug={song.venueSlug ?? null}
        share_id={song.id}
        recipient_name={song.name}
        language={song.language}
        genre={song.genre}
      />
      <ShareTemplateView song={song} />
    </>
  );
}
