import React from "react";
import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { BirthdaySong } from "./BirthdaySong";
import { birthdaySongSchema, type BirthdaySongProps } from "./schema";

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
// Fallback length if audio duration can't be probed (Suno tracks are ~60–120s).
const DEFAULT_DURATION_SEC = 60;

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
