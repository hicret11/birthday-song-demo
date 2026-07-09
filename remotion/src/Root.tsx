import React from "react";
import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { BirthdaySong } from "./BirthdaySong";
import {
  PremiereVideo,
  CREDITS_SEC,
  NOTE_TEXT_SEC,
} from "./PremiereVideo";
import {
  birthdaySongSchema,
  premiereVideoSchema,
  type BirthdaySongProps,
  type PremiereVideoProps,
} from "./schema";

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
// Fallback length if audio duration can't be probed (Suno tracks are ~60–120s).
const DEFAULT_DURATION_SEC = 60;

async function probeSec(url: string | undefined, fallback: number): Promise<number> {
  if (!url) return fallback;
  try {
    const s = await getAudioDurationInSeconds(url);
    return Number.isFinite(s) && s > 0 ? s : fallback;
  } catch {
    return fallback;
  }
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
    {/* The Premiere video (Phase D) — one composition, both aspects. Dimensions
        + duration are resolved from props.aspect and the probed audio lengths. */}
    <Composition
      id="PremiereVideo"
      component={PremiereVideo}
      schema={premiereVideoSchema}
      durationInFrames={DEFAULT_DURATION_SEC * FPS}
      fps={FPS}
      width={1920}
      height={1080}
      calculateMetadata={async ({ props }) => {
        const songSec = await probeSec(props.audioSrc, DEFAULT_DURATION_SEC);
        const noteSec = await probeSec(props.noteAudioSrc, 0);
        const noteWindow = props.noteAudioSrc
          ? Math.max(noteSec, 3)
          : props.directorNoteText
            ? NOTE_TEXT_SEC
            : 0;
        const totalSec = songSec + noteWindow + CREDITS_SEC;
        const portrait = props.aspect === "9:16";
        return {
          durationInFrames: Math.ceil(totalSec * FPS),
          width: portrait ? 1080 : 1920,
          height: portrait ? 1920 : 1080,
          props: { ...props, songDurationSec: songSec, noteDurationSec: noteSec },
        };
      }}
      defaultProps={
        {
          name: "Sofia",
          directorName: "Mom & Dad",
          audioSrc: staticFile("sample.mp3"),
          directorNoteText: "You make the whole family brighter. Happy birthday.",
          theme: "classic",
          language: "English",
          aspect: "16:9",
          contributors: ["Mom", "Dad", "Grandma Rosa", "Leo"],
          photoUrls: [
            staticFile("photo1.jpg"),
            staticFile("photo2.jpg"),
            staticFile("photo3.jpg"),
          ],
          watermark: "singmybirthday.com",
          starringLabel: "Starring",
          producedByLabel: "Produced & directed by",
          withLoveLabel: "With love from",
          noteLabel: "A message from the director",
          songDurationSec: 0,
          noteDurationSec: 0,
        } satisfies PremiereVideoProps
      }
    />
    <Composition
      id="BirthdaySong"
      component={BirthdaySong}
      schema={birthdaySongSchema}
      durationInFrames={DEFAULT_DURATION_SEC * FPS}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      // Drive the composition length from the actual song audio so the video
      // ends exactly with the track. Falls back to DEFAULT_DURATION_SEC.
      calculateMetadata={async ({ props }) => {
        let seconds = DEFAULT_DURATION_SEC;
        try {
          if (props.audioSrc) {
            const probed = await getAudioDurationInSeconds(props.audioSrc);
            if (Number.isFinite(probed) && probed > 0) seconds = probed;
          }
        } catch {
          // Keep the fallback duration — never fail metadata resolution.
        }
        return { durationInFrames: Math.ceil(seconds * FPS) };
      }}
      // Offline test data: everything resolves from remotion/public via
      // staticFile() so the composition renders fully without the backend
      // worker (local sample.mp3 + 3 photos). Swap these back to the real
      // https song/photo URLs when wiring the render worker.
      defaultProps={
        {
          name: "Sofia",
          senderName: "Mom & Dad",
          personalNote: "We love you!",
          theme: "classic",
          language: "English",
          audioSrc: staticFile("sample.mp3"),
          photoUrls: [
            staticFile("photo1.jpg"),
            staticFile("photo2.jpg"),
            staticFile("photo3.jpg"),
          ],
          watermark: "singmybirthday.com",
          captions: [
            { text: "Happy birthday dear Sofia", startMs: 1000, endMs: 4000 },
            { text: "Another year of shining bright", startMs: 4200, endMs: 8000 },
            { text: "Make a wish and hold it tight", startMs: 8200, endMs: 12000 },
            { text: "We love you more each passing day", startMs: 12200, endMs: 16000 },
            { text: "Feliz cumpleaños, Sofia!", startMs: 16200, endMs: 20000 },
          ],
        } satisfies BirthdaySongProps
      }
    />
    </>
  );
};
