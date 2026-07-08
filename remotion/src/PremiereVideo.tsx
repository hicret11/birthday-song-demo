import React, { useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import type { PremiereVideoProps } from "./schema";
import { BRAND_DARK, happyBirthdayFor, isRtl, themeFor } from "./theme";

/**
 * PremiereVideo — the delivered video IS the premiere (Phase D).
 *
 * Timeline: curtain raise → name-in-lights marquee → Ken-Burns photo "scenes"
 * with audio-reactive bars → the director's note → a credits roll. One
 * component serves both aspects (16:9 default, 9:16 on demand) by reflowing off
 * useVideoConfig. Duration is set by calculateMetadata: song + optional voice
 * note + a fixed credits tail. Deterministic (no Math.random/Date) so every
 * render is identical.
 */
const FPS = 30;
export const CURTAIN_SEC = 1.6;
export const CREDITS_SEC = 5;
export const NOTE_TEXT_SEC = 5; // note-card window when there's text but no voice

export const PremiereVideo: React.FC<PremiereVideoProps> = (props) => {
  const {
    name,
    directorName,
    audioSrc,
    noteAudioSrc,
    directorNoteText,
    theme,
    photoUrls,
    contributors,
    watermark,
    language,
    starringLabel,
    producedByLabel,
    withLoveLabel,
    noteLabel,
    songDurationSec,
    noteDurationSec,
  } = props;

  const tokens = themeFor(theme);
  const rtl = isRtl(language);
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const fs = (n: number) => Math.round((n * base) / 1080);

  const songFrames = Math.ceil(songDurationSec * FPS);
  // Note window: the voice-note length if present, else a fixed text beat, else 0.
  const noteWindowSec = noteAudioSrc
    ? Math.max(noteDurationSec, 3)
    : directorNoteText
      ? NOTE_TEXT_SEC
      : 0;
  const noteFrames = Math.ceil(noteWindowSec * FPS);
  const creditsFrames = Math.ceil(CREDITS_SEC * FPS);
  const noteStart = songFrames;
  const creditsStart = songFrames + noteFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_DARK, direction: rtl ? "rtl" : "ltr" }}>
      <StageBackground />
      {photoUrls && photoUrls.length > 0 ? (
        <Sequence from={0} durationInFrames={songFrames}>
          <PhotoScenes photoUrls={photoUrls} />
        </Sequence>
      ) : null}

      {/* Audio: the song, then the director's voice note (if any). */}
      <Audio src={audioSrc} />
      {noteAudioSrc ? (
        <Sequence from={noteStart}>
          <Audio src={noteAudioSrc} />
        </Sequence>
      ) : null}

      {/* Audio-reactive bars over the song body. */}
      <Sequence from={0} durationInFrames={songFrames}>
        <Bars audioSrc={audioSrc} accent={tokens.accent} fs={fs} />
      </Sequence>

      {/* Name-in-lights marquee — the star's headline over the opening. */}
      <Sequence from={0} durationInFrames={songFrames}>
        <Marquee
          title={`${happyBirthdayFor(language)},`}
          name={name}
          tokens={tokens}
          fs={fs}
        />
      </Sequence>

      {/* The director's note — closing beat, shown over the note window. */}
      {noteFrames > 0 ? (
        <Sequence from={noteStart} durationInFrames={noteFrames + creditsFrames}>
          <NoteCard
            label={noteLabel}
            text={directorNoteText}
            hasVoice={!!noteAudioSrc}
            tokens={tokens}
            fs={fs}
          />
        </Sequence>
      ) : null}

      {/* Credits roll. */}
      <Sequence from={creditsStart} durationInFrames={creditsFrames}>
        <CreditsRoll
          name={name}
          directorName={directorName}
          contributors={contributors}
          starringLabel={starringLabel}
          producedByLabel={producedByLabel}
          withLoveLabel={withLoveLabel}
          tokens={tokens}
          fs={fs}
        />
      </Sequence>

      {/* Curtain raise over the very open. */}
      <Curtain fs={fs} />

      <Watermark text={watermark} fs={fs} />
    </AbsoluteFill>
  );
};

type Tokens = ReturnType<typeof themeFor>;

// Slow, bounded brand gradient — never drifts off-palette.
const StageBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const drift = Math.sin(t * 0.16);
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_DARK }}>
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(48% 44% at ${24 + drift * 3}% ${26 + drift * 2}%, rgba(236,72,153,0.55), transparent 63%),
            radial-gradient(54% 48% at ${78 - drift * 3}% ${74 + drift * 2}%, rgba(168,85,247,0.5), transparent 64%),
            radial-gradient(46% 40% at 50% 100%, rgba(245,158,11,0.38), transparent 60%)
          `,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(60% 30% at 50% 0%, rgba(236,72,153,0.16), transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Ken-Burns photo scenes with top/bottom scrim so overlays stay legible.
const PhotoScenes: React.FC<{ photoUrls: string[] }> = ({ photoUrls }) => {
  const { durationInFrames } = useVideoConfig();
  const photos = photoUrls.slice(0, 8);
  const per = Math.max(1, Math.floor(durationInFrames / photos.length));
  const hold = per + Math.round(FPS * 0.6);
  return (
    <AbsoluteFill>
      {photos.map((url, i) => (
        <Sequence key={`${url}-${i}`} from={i * per} durationInFrames={hold}>
          <KenBurns url={url} duration={hold} index={i} />
        </Sequence>
      ))}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,4,26,0.8) 0%, rgba(10,4,26,0.25) 22%, rgba(10,4,26,0) 45%, rgba(10,4,26,0) 58%, rgba(10,4,26,0.45) 80%, rgba(10,4,26,0.88) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const KenBurns: React.FC<{ url: string; duration: number; index: number }> = ({
  url,
  duration,
  index,
}) => {
  const frame = useCurrentFrame();
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const scale = interpolate(frame, [0, duration], [1.06, 1.16]);
  const panX = interpolate(frame, [0, duration], index % 2 === 0 ? [-2, 2] : [2, -2]);
  const fadeIn = interpolate(frame, [0, FPS * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [duration - FPS * 0.6, duration], [1, 0], {
    extrapolateLeft: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <Img
        src={url}
        onError={() => setBroken(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          filter: "saturate(1.08) contrast(1.1) brightness(0.9)",
          transform: `scale(${scale}) translateX(${panX}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Curtain raise — two velvet panels part in the first ~1.6s.
const Curtain: React.FC<{ fs: (n: number) => number }> = ({ fs }) => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [FPS * 0.4, FPS * CURTAIN_SEC], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (open >= 100) return null;
  const panel = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "52%",
    [side]: 0,
    transform: `translateX(${side === "left" ? -open : open}%)`,
    background:
      "repeating-linear-gradient(90deg, #4a0420 0px, #6b0a2e 26px, #3a0119 52px)",
    boxShadow: "inset 0 0 120px rgba(0,0,0,0.6)",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={panel("left")} />
      <div style={panel("right")} />
      {/* Gold trim glow along the parting edge */}
      <AbsoluteFill
        style={{
          opacity: interpolate(open, [0, 100], [0.9, 0]),
          background:
            "radial-gradient(40% 60% at 50% 50%, rgba(255,207,107,0.18), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: fs(40),
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: fs(26),
          letterSpacing: fs(6),
          textTransform: "uppercase",
          color: "#ffcf6b",
          opacity: interpolate(open, [0, 60], [1, 0], { extrapolateRight: "clamp" }),
        }}
      >
        Now casting · one night only
      </div>
    </AbsoluteFill>
  );
};

// Name-in-lights marquee: greeting + big glowing star name, framed by bulbs.
const Marquee: React.FC<{
  title: string;
  name: string;
  tokens: Tokens;
  fs: (n: number) => number;
}> = ({ title, name, tokens, fs }) => {
  const frame = useCurrentFrame();
  const reveal = spring({ frame: frame - FPS * 0.8, fps: FPS, config: { damping: 13, mass: 0.8 } });
  const scale = interpolate(reveal, [0, 1], [0.8, 1]);
  const bulbs = 14;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `0 ${fs(60)}px` }}>
      <div style={{ transform: `scale(${scale})`, opacity: reveal }}>
        <p
          style={{
            fontFamily: tokens.fontFamily,
            fontWeight: 700,
            fontSize: fs(40),
            color: tokens.headlineColor,
            margin: 0,
            letterSpacing: fs(2),
          }}
        >
          {title}
        </p>
        <div
          style={{
            position: "relative",
            marginTop: fs(14),
            padding: `${fs(18)}px ${fs(44)}px`,
            borderRadius: fs(24),
            border: `${fs(3)}px solid rgba(255,207,107,0.7)`,
            background: "rgba(18,6,47,0.35)",
          }}
        >
          {/* Marquee bulbs top + bottom */}
          {(["top", "bottom"] as const).map((edge) => (
            <div
              key={edge}
              style={{
                position: "absolute",
                left: fs(20),
                right: fs(20),
                [edge]: fs(-6),
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {Array.from({ length: bulbs }).map((_, i) => {
                const on = (Math.floor(frame / 4) + i) % 2 === 0;
                return (
                  <span
                    key={i}
                    style={{
                      width: fs(10),
                      height: fs(10),
                      borderRadius: "50%",
                      background: on ? "#ffe6a3" : "rgba(255,207,107,0.35)",
                      boxShadow: on ? `0 0 ${fs(12)}px #ffcf6b` : "none",
                    }}
                  />
                );
              })}
            </div>
          ))}
          <h1
            style={{
              fontFamily: tokens.fontFamily,
              fontWeight: 900,
              fontSize: fs(120),
              lineHeight: 1.02,
              margin: 0,
              color: tokens.headlineColor,
              WebkitTextStroke: `${fs(6)}px ${tokens.strokeColor}`,
              paintOrder: "stroke fill",
              textShadow: `0 0 ${fs(40)}px ${tokens.accent}`,
            }}
          >
            {name}
          </h1>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Center-mirrored audio-reactive equalizer bars.
const Bars: React.FC<{ audioSrc: string; accent: string; fs: (n: number) => number }> = ({
  audioSrc,
  accent,
  fs,
}) => {
  const frame = useCurrentFrame();
  const audioData = useAudioData(audioSrc);
  if (!audioData) return null;
  const HALF = 24;
  const raw = visualizeAudio({ fps: FPS, frame, audioData, numberOfSamples: 64 }).slice(0, HALF);
  const mirrored = [...raw].reverse().concat(raw);
  const MAXH = fs(260);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: fs(120) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: fs(7), height: MAXH, width: "82%" }}>
        {mirrored.map((v, i) => {
          const h = Math.max(fs(10), Math.min(MAXH, v * fs(2600)));
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: 999,
                background: `linear-gradient(180deg, rgba(255,255,255,0.95), ${accent} 78%)`,
                boxShadow: `0 0 ${fs(12)}px ${accent}`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Director's note card — the closing beat.
const NoteCard: React.FC<{
  label: string;
  text?: string;
  hasVoice: boolean;
  tokens: Tokens;
  fs: (n: number) => number;
}> = ({ label, text, hasVoice, tokens, fs }) => {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: { damping: 14, mass: 0.7 } });
  const opacity = interpolate(frame, [0, FPS * 0.5], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `0 ${fs(80)}px` }}>
      <AbsoluteFill style={{ background: "rgba(6,2,20,0.5)", opacity }} />
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`, opacity, position: "relative" }}>
        <p style={{ fontFamily: tokens.fontFamily, fontSize: fs(34), color: "#ffcf6b", letterSpacing: fs(3), textTransform: "uppercase", margin: 0 }}>
          {label}
        </p>
        {text ? (
          <p
            style={{
              fontFamily: tokens.fontFamily,
              fontWeight: 600,
              fontStyle: "italic",
              fontSize: fs(56),
              lineHeight: 1.3,
              color: "#fff",
              marginTop: fs(24),
              textShadow: "0 2px 16px rgba(0,0,0,0.6)",
            }}
          >
            {`“${text}”`}
          </p>
        ) : null}
        {hasVoice ? (
          <p style={{ fontFamily: tokens.fontFamily, fontSize: fs(30), color: "rgba(255,255,255,0.7)", marginTop: fs(20) }}>
            ♪ ♫ ♪
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Credits roll — Starring / Produced & directed by / With love + contributors.
const CreditRow: React.FC<{ role: string; who: string; tokens: Tokens; fs: (n: number) => number }> = ({
  role,
  who,
  tokens,
  fs,
}) => (
  <div style={{ marginBottom: fs(40) }}>
    <p style={{ fontFamily: tokens.fontFamily, fontSize: fs(28), letterSpacing: fs(4), textTransform: "uppercase", color: "#ffcf6b", margin: 0 }}>
      {role}
    </p>
    <p style={{ fontFamily: tokens.fontFamily, fontWeight: 800, fontSize: fs(56), color: "#fff", margin: `${fs(6)}px 0 0` }}>
      {who}
    </p>
  </div>
);

const CreditsRoll: React.FC<{
  name: string;
  directorName?: string;
  contributors: string[];
  starringLabel: string;
  producedByLabel: string;
  withLoveLabel: string;
  tokens: Tokens;
  fs: (n: number) => number;
}> = ({ name, directorName, contributors, starringLabel, producedByLabel, withLoveLabel, tokens, fs }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  // Scroll the credits stack upward across the window.
  const y = interpolate(frame, [0, durationInFrames], [height * 0.5, -height * 0.35]);
  const opacity = interpolate(frame, [0, FPS * 0.4], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "rgba(6,2,20,0.7)" }}>
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", textAlign: "center", transform: `translateY(${y}px)`, opacity }}>
        <CreditRow role={starringLabel} who={name} tokens={tokens} fs={fs} />
        {directorName ? <CreditRow role={producedByLabel} who={directorName} tokens={tokens} fs={fs} /> : null}
        {contributors.length > 0 ? (
          <div style={{ marginBottom: fs(40) }}>
            <p style={{ fontFamily: tokens.fontFamily, fontSize: fs(28), letterSpacing: fs(4), textTransform: "uppercase", color: "#ffcf6b", margin: 0 }}>
              {withLoveLabel}
            </p>
            {contributors.slice(0, 20).map((c, i) => (
              <p key={i} style={{ fontFamily: tokens.fontFamily, fontWeight: 700, fontSize: fs(40), color: "#fff", margin: `${fs(4)}px 0 0` }}>
                {c}
              </p>
            ))}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Watermark: React.FC<{ text: string; fs: (n: number) => number }> = ({ text, fs }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: fs(40) }}>
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontWeight: 700,
        fontSize: fs(26),
        color: "rgba(255,255,255,0.85)",
        padding: `${fs(8)}px ${fs(18)}px`,
        borderRadius: 999,
        background: "rgba(0,0,0,0.3)",
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);
