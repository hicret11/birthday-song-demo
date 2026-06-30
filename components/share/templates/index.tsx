import type { ShareTemplate, SharedSong } from "@/lib/api-types";
import { Classic } from "./Classic";
import { Neon } from "./Neon";
import { Elegant } from "./Elegant";
import { Playful } from "./Playful";
import { Corporate } from "./Corporate";

const TEMPLATES: Record<ShareTemplate, (props: { song: SharedSong }) => React.ReactElement> = {
  classic: Classic,
  neon: Neon,
  elegant: Elegant,
  playful: Playful,
  corporate: Corporate,
};

export function ShareTemplateView({ song }: { song: SharedSong }) {
  const Component = TEMPLATES[song.template] ?? Classic;
  return <Component song={song} />;
}
