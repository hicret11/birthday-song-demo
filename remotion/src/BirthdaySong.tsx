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
import type { BirthdaySongProps, Caption } from "./schema";
import {
  BRAND_DARK,
  CONFETTI_COLORS,
  happyBirthdayFor,
  isRtl,
  themeFor,
} from "./theme";

/**
 * BirthdaySong — the premium 9:16 karaoke video composition.
 *
 * Layers (back → front):
 *   1. Brand-only gradient background + a Deluxe Ken-Burns photo montage. The
 *      photos are the hero (natural color) behind a top/bottom scrim only.
 *   2. Big centered waveform driven by the song audio.
 *   3. Headline that shrinks into a compact top plaque after the intro.
 *   4. Karaoke captions synced to time (active word highlighted).
 *   5. Confetti raining full-width; an animated outro card at the end.
 */
export const BirthdaySong: React.FC<BirthdaySongProps> = (props) => {
  const {
    name,
    senderName,
    personalNote,
    audioSrc,
    theme,
    photoUrls,
    watermark,
    captions,
    language,
  } = props;

  const tokens = themeFor(theme);
  const rtl = isRtl(language);
  const { fps, durationInFrames } = useVideoConfig();

  // Outro window: the final stretch after the karaoke lines end. Target ~3s,
  // but never start before the last caption has finished so they don't overlap.
  const lastCaptionEndMs = captions.length
    ? Math.max(...captions.map((c) => c.endMs))
    : 0;
  const lastCaptionFrame = Math.round((lastCaptionEndMs / 1000) * fps);
  const outroStart = Math.min(
    durationInFrames - 1,
    Math.max(lastCaptionFrame, durationInFrames - Math.round(fps * 3)),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_DARK, direction: rtl ? "rtl" : "ltr" }}>
      {/* 1. Brand background (fallback for gaps / broken photos) + hero photos. */}
      <GradientBackground />
      {photoUrls && photoUrls.length > 0 ? (
        <PhotoMontage photoUrls={photoUrls} />
      ) : null}

      {/* Song audio drives both playback and the waveform. */}
      <Audio src={audioSrc} />

      {/* 2. Waveform */}
      <Waveform audioSrc={audioSrc} accent={tokens.accent} />

      {/* 3. Headline (compacts into a top plaque, then fades before the outro) */}
      <Headline
        title={`${happyBirthdayFor(language)}, ${name}`}
        color={tokens.headlineColor}
        stroke={tokens.strokeColor}
        fontFamily={tokens.fontFamily}
        senderName={senderName}
        personalNote={personalNote}
        outroStart={outroStart}
      />

      {/* 4. Karaoke captions */}
      <Captions
        captions={captions}
        active={tokens.captionActive}
        idle={tokens.captionIdle}
        stroke={tokens.strokeColor}
        fontFamily={tokens.fontFamily}
      />

      {/* 5. Confetti (headline burst + sparse background + outro burst) */}
      <Confetti outroStart={outroStart} />

      {/* Slim song-progress bar hugging the bottom edge. */}
      <ProgressBar outroStart={outroStart} accent={tokens.accent} />

      {/* Watermark (fades out under the outro card) */}
      <Watermark text={watermark} outroStart={outroStart} />

      {/* Animated outro card: big greeting + CTA, no frozen empty frame. */}
      <Outro
        greeting={`${happyBirthdayFor(language)}, ${name}! 🎉`}
        cta={watermark}
        color={tokens.headlineColor}
        stroke={tokens.strokeColor}
        accent={tokens.accent}
        fontFamily={tokens.fontFamily}
        outroStart={outroStart}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 1. Brand-only gradient background.
//
// Strictly pink / purple / amber radial blobs over a dark brand base. Two
// fixed arrangements slowly cross-fade and drift — there is NO hue
// interpolation, so the palette can never wander into green/blue/rainbow.
// ---------------------------------------------------------------------------
const GradientBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Very slow, bounded motion.
  const drift = Math.sin(t * 0.18); // -1..1
  const cf = (Math.sin(t * 0.12) + 1) / 2; // 0..1 cross-fade weight

  const layerA = `
    radial-gradient(46% 40% at ${22 + drift * 3}% ${28 + drift * 2}%, rgba(236,72,153,0.60), transparent 62%),
    radial-gradient(52% 46% at ${78 - drift * 3}% ${72 + drift * 2}%, rgba(168,85,247,0.55), transparent 64%),
    radial-gradient(46% 40% at ${50 + drift * 4}% 98%, rgba(245,158,11,0.42), transparent 60%)
  `;
  const layerB = `
    radial-gradient(50% 44% at ${76 + drift * 3}% ${24 - drift * 2}%, rgba(168,85,247,0.58), transparent 62%),
    radial-gradient(48% 42% at ${26 - drift * 3}% ${68 + drift * 2}%, rgba(236,72,153,0.55), transparent 64%),
    radial-gradient(40% 36% at 18% 8%, rgba(245,158,11,0.38), transparent 58%)
  `;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_DARK }}>
      <AbsoluteFill style={{ background: layerA, opacity: 1 - cf }} />
      <AbsoluteFill style={{ background: layerB, opacity: cf }} />
      {/* Soft brand-tinted top glow for depth (no white blow-out). */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(60% 30% at 50% 0%, rgba(236,72,153,0.18), transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 1b. Deluxe Ken-Burns photo montage — the photo is the hero.
//
// Natural color (only a whisper of desaturation), cover-cropped to fill the
// 9:16 frame, with a gentle zoom. Legibility comes from a scrim that only
// darkens the TOP (under the header) and BOTTOM (under karaoke + waveform),
// leaving the middle of the photo clear, plus a low-opacity brand vignette.
// ---------------------------------------------------------------------------
const PhotoMontage: React.FC<{ photoUrls: string[] }> = ({ photoUrls }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const photos = photoUrls.slice(0, 8);
  const perPhoto = Math.max(1, Math.floor(durationInFrames / photos.length));
  const holdWithFade = perPhoto + Math.round(fps * 0.6);

  return (
    <AbsoluteFill>
      {photos.map((url, i) => (
        <Sequence key={`${url}-${i}`} from={i * perPhoto} durationInFrames={holdWithFade}>
          <KenBurnsPhoto url={url} durationInFrames={holdWithFade} index={i} />
        </Sequence>
      ))}
      {/* Top + bottom scrim only — the middle band stays clear so the photo
          reads as the hero. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,4,26,0.78) 0%, rgba(10,4,26,0.30) 18%, rgba(10,4,26,0) 38%, rgba(10,4,26,0) 60%, rgba(10,4,26,0.42) 80%, rgba(10,4,26,0.85) 100%)",
        }}
      />
      {/* Low-opacity brand vignette to focus the center and seat the photo in
          the palette. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(125% 82% at 50% 45%, transparent 58%, rgba(74,4,78,0.28) 82%, rgba(18,6,47,0.5) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const KenBurnsPhoto: React.FC<{ url: string; durationInFrames: number; index: number }> = ({
  url,
  durationInFrames,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [broken, setBroken] = useState(false);

  // Broken / missing image → render nothing so the clean brand gradient shows
  // through (no checkerboard, no test pattern, no letterbox).
  if (broken) return null;

  const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.16]);
  const panX = interpolate(frame, [0, durationInFrames], index % 2 === 0 ? [-2, 2] : [2, -2]);
  const panY = interpolate(frame, [0, durationInFrames], index % 2 === 0 ? [1.5, -1.5] : [-1.5, 1.5]);
  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.6, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <Img
        src={url}
        onError={() => setBroken(true)}
        style={{
          width: "100%",
          height: "100%",
          // cover-fit + crop to fill 1080x1920 with no letterbox.
          objectFit: "cover",
          objectPosition: "center",
          // Richer, more cinematic grade: a touch MORE saturation + contrast so
          // even flat/hazy phone photos read as intentional and premium, with a
          // slight brightness pull-down so the overlays sit cleanly on top.
          filter: "saturate(1.08) contrast(1.1) brightness(0.93)",
          transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. Big centered waveform — the visual anchor of the audio.
// ---------------------------------------------------------------------------
const Waveform: React.FC<{ audioSrc: string; accent: string }> = ({ audioSrc, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioSrc);

  if (!audioData) return null;

  // Take the loud low/mid band, then MIRROR it so the energy peaks in the
  // CENTER and tapers to both edges. This turns the raw (left-heavy) FFT graph
  // into a balanced, always-full equalizer that looks good on any audio —
  // including near-silence. Bars grow from a horizontal centerline (up + down).
  const HALF = 24; // bars per side → 48 total
  const raw = visualizeAudio({ fps, frame, audioData, numberOfSamples: 64 }).slice(0, HALF);
  const mirrored = [...raw].reverse().concat(raw);
  const MAXH = 300;

  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 205 }}
    >
      {/* Soft brand bloom behind the bars for depth. */}
      <div
        style={{
          position: "absolute",
          bottom: 330,
          width: "58%",
          height: 10,
          background: accent,
          filter: "blur(36px)",
          opacity: 0.5,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          height: MAXH,
          width: "90%",
        }}
      >
        {mirrored.map((v, i) => {
          const height = Math.max(10, Math.min(MAXH, v * 2600));
          // Slight brightness lift toward the center bars.
          const centerDist = Math.abs(i - (mirrored.length - 1) / 2) / (mirrored.length / 2);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height,
                borderRadius: 999,
                background: `linear-gradient(180deg, rgba(255,255,255,0.97), ${accent} 78%)`,
                boxShadow: `0 0 12px ${accent}`,
                opacity: 0.9 - centerDist * 0.18,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. Headline — big spring reveal, then shrinks into a compact top plaque so
//    the center is free for the karaoke. Sender + note fade out after the
//    intro, and the whole header fades out at the outro.
// ---------------------------------------------------------------------------
const Headline: React.FC<{
  title: string;
  color: string;
  stroke: string;
  fontFamily: string;
  senderName?: string;
  personalNote?: string;
  outroStart: number;
}> = ({ title, color, stroke, fontFamily, senderName, personalNote, outroStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });

  // Intro → compact transition around 2.5–3.3s: scale down and move up.
  const compact = interpolate(frame, [fps * 2.5, fps * 3.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const baseScale = interpolate(reveal, [0, 1], [0.7, 1]);
  const scale = baseScale * interpolate(compact, [0, 1], [1, 0.56]);
  const y = interpolate(reveal, [0, 1], [40, 0]) + interpolate(compact, [0, 1], [0, -150]);

  const introOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const outroFade = interpolate(frame, [outroStart, outroStart + fps * 0.5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = introOpacity * outroFade;

  // Sender + note: fade out ~3.5–4.2s (they belong to the intro only).
  const subFade = interpolate(frame, [fps * 3.5, fps * 4.2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 150,
        textAlign: "center",
      }}
    >
      <div style={{ transform: `translateY(${y}px) scale(${scale})`, opacity }}>
        <div
          style={{
            display: "inline-block",
            // Plaque backing fades in as the headline compacts, keeping it
            // legible over any photo.
            background: `rgba(18,6,47,${compact * 0.5})`,
            borderRadius: 44,
            padding: `${8 + compact * 6}px ${compact * 40}px`,
          }}
        >
          <h1
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 108,
              lineHeight: 1.02,
              margin: 0,
              padding: "0 48px",
              color,
              WebkitTextStroke: `6px ${stroke}`,
              paintOrder: "stroke fill",
              textShadow: `0 8px 30px rgba(0,0,0,0.4)`,
            }}
          >
            {title}
          </h1>
        </div>
        {senderName ? (
          <p
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 44,
              marginTop: 24,
              color,
              opacity: subFade,
              WebkitTextStroke: `3px ${stroke}`,
              paintOrder: "stroke fill",
            }}
          >
            {`from ${senderName}`}
          </p>
        ) : null}
        {personalNote ? (
          <p
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 38,
              marginTop: 12,
              padding: "0 72px",
              color: "rgba(255,255,255,0.92)",
              opacity: subFade,
              fontStyle: "italic",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {`“${personalNote}”`}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Karaoke captions — active word highlighted, synced to time.
//    Sits a little above center with a soft dark backing for legibility.
// ---------------------------------------------------------------------------
const Captions: React.FC<{
  captions: Caption[];
  active: string;
  idle: string;
  stroke: string;
  fontFamily: string;
}> = ({ captions, active, stroke, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const line = captions.find((c) => nowMs >= c.startMs && nowMs <= c.endMs);
  if (!line) return null;

  // Distribute time evenly across the words of the active line to drive the
  // per-word highlight. (Whisper gives line-level timings here; even splitting
  // yields a natural karaoke sweep.)
  const words = line.text.split(/\s+/).filter(Boolean);
  const span = Math.max(1, line.endMs - line.startMs);
  const progress = (nowMs - line.startMs) / span;
  const activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length));

  // Gentle pop-in as the line appears.
  const linePop = spring({
    frame: frame - Math.round((line.startMs / 1000) * fps),
    fps,
    config: { damping: 14, mass: 0.5 },
  });
  const scale = interpolate(linePop, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 72px",
      }}
    >
      {/* Karaoke line, nudged a little above center, on a SOLID dark pill so it
          stays readable over any photo (bright skies included). */}
      <div
        style={{
          transform: `translateY(-120px) scale(${scale})`,
          maxWidth: "90%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "0 20px",
          padding: "26px 46px",
          borderRadius: 40,
          background: "rgba(10,4,25,0.58)",
          boxShadow: "0 12px 44px rgba(0,0,0,0.5)",
        }}
      >
        {words.map((w, i) => {
          const sung = i < activeIndex; // already passed
          const current = i === activeIndex; // the word being sung right now
          // Three states: sung words carry the accent (progress), the CURRENT
          // word pops — bigger, brighter, strong glow — and upcoming words stay
          // dimmed white so they read on any background without stealing focus.
          const color = current || sung ? active : "rgba(255,255,255,0.5)";
          return (
            <span
              key={`${w}-${i}`}
              style={{
                display: "inline-block",
                fontFamily,
                fontWeight: 900,
                fontSize: 74,
                lineHeight: 1.15,
                color,
                WebkitTextStroke: `4px ${stroke}`,
                paintOrder: "stroke fill",
                textShadow: current
                  ? `0 0 30px ${active}, 0 0 14px ${active}, 0 3px 14px rgba(0,0,0,0.9)`
                  : sung
                    ? `0 0 12px ${active}, 0 2px 12px rgba(0,0,0,0.85)`
                    : "0 3px 14px rgba(0,0,0,0.85)",
                transform: current ? "translateY(-8px) scale(1.1)" : "none",
                transformOrigin: "center bottom",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 5a. Confetti — real particles raining top → bottom across the full width.
//
// Three groups: a dense one-shot BURST during the headline moment, a sparse
// AMBIENT layer that keeps drifting through the song, and a second burst that
// fires at the OUTRO. All positions come from a per-particle seed, so every
// render is identical.
// ---------------------------------------------------------------------------
const BURST_COUNT = 90;
const AMBIENT_COUNT = 26;
const OUTRO_COUNT = 80;

// Deterministic hash → [0,1). Stable across renders (no Math.random / Date).
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const Confetti: React.FC<{ outroStart: number }> = ({ outroStart }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const outroSec = outroStart / fps;

  const pieces: React.ReactNode[] = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    pieces.push(confettiPiece(i, "burst", t, width, height, 0));
  }
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    pieces.push(confettiPiece(1000 + i, "ambient", t, width, height, 0));
  }
  for (let i = 0; i < OUTRO_COUNT; i++) {
    pieces.push(confettiPiece(2000 + i, "burst", t, width, height, outroSec));
  }

  return <AbsoluteFill style={{ pointerEvents: "none" }}>{pieces}</AbsoluteFill>;
};

const confettiPiece = (
  i: number,
  mode: "burst" | "ambient",
  t: number,
  width: number,
  height: number,
  startBias: number,
): React.ReactNode => {
  const r1 = hash(i * 1.3 + 1);
  const r2 = hash(i * 2.7 + 5);
  const r3 = hash(i * 3.9 + 9);
  const r4 = hash(i * 5.1 + 13);

  const color = CONFETTI_COLORS[Math.floor(hash(i * 6.3 + 17) * CONFETTI_COLORS.length)];
  const xBase = r1 * width; // spread across the FULL width
  const size = 10 + r2 * 20; // 10–30px, mixed sizes
  const isCircle = r3 > 0.5;
  const rotSpeed = (r4 - 0.5) * 900; // deg/s, both directions
  const driftAmp = 24 + r2 * 90; // horizontal sway in px
  const driftFreq = 0.5 + r3; // sway speed

  let startDelay: number;
  let fallDur: number;
  let loop: boolean;
  if (mode === "burst") {
    // Dense front-loaded burst (headline reveal, or the outro when biased).
    startDelay = startBias + (startBias > 0 ? r4 * 0.5 : 0.4 + r4 * 0.7);
    fallDur = 2.0 + r1 * 1.3; // 2.0–3.3s
    loop = false;
  } else {
    // Sparse continuous background that recycles from the top.
    startDelay = r4 * 6; // staggered over the first 6s
    fallDur = 4.5 + r1 * 3; // 4.5–7.5s, slower
    loop = true;
  }

  const since = t - startDelay;
  if (since < 0) return null;

  const local = loop ? since % fallDur : since;
  if (!loop && local > fallDur) return null; // burst piece finished its single fall

  const p = local / fallDur; // 0..1 progress down the frame
  const y = -size + p * (height + 2 * size);
  const x = xBase + Math.sin(t * driftFreq + r2 * 6.2832) * driftAmp;
  const rot = local * rotSpeed;

  // Fade in near the top, fade out near the bottom.
  const opacity =
    Math.min(1, p / 0.08) *
    Math.min(1, (1 - p) / 0.12) *
    (mode === "ambient" ? 0.8 : 1);

  return (
    <div
      key={`${mode}-${startBias > 0 ? "outro-" : ""}${i}`}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: isCircle ? size : size * 0.62,
        background: color,
        borderRadius: isCircle ? "50%" : 3,
        opacity,
        transform: `rotate(${rot}deg)`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// 5b. Animated outro card — big greeting + CTA, fades in over the final beats
//     so the video never freezes on an empty frame.
// ---------------------------------------------------------------------------
const Outro: React.FC<{
  greeting: string;
  cta: string;
  color: string;
  stroke: string;
  accent: string;
  fontFamily: string;
  outroStart: number;
}> = ({ greeting, cta, color, stroke, accent, fontFamily, outroStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - outroStart;
  if (t < 0) return null;

  const pop = spring({ frame: t, fps, config: { damping: 12, mass: 0.7 } });
  const scale = interpolate(pop, [0, 1], [0.72, 1]);
  const opacity = interpolate(t, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      {/* Dim the frame behind the card so the greeting pops. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(75% 55% at 50% 50%, rgba(6,2,20,0.55), rgba(6,2,20,0.32))",
          opacity,
        }}
      />
      <div style={{ transform: `scale(${scale})`, opacity, position: "relative", padding: "0 48px" }}>
        <h1
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 100,
            lineHeight: 1.05,
            margin: 0,
            color,
            WebkitTextStroke: `6px ${stroke}`,
            paintOrder: "stroke fill",
            textShadow: `0 0 40px ${accent}, 0 10px 34px rgba(0,0,0,0.5)`,
          }}
        >
          {greeting}
        </h1>
        <p
          style={{
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontWeight: 700,
            fontSize: 42,
            marginTop: 40,
            color: "#ffffff",
            letterSpacing: 1,
            padding: "12px 30px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.34)",
            display: "inline-block",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          {cta}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Slim song-progress bar along the very bottom edge — a subtle premium cue that
// fills left→right across the whole video and fades out under the outro card.
// ---------------------------------------------------------------------------
const ProgressBar: React.FC<{ outroStart: number; accent: string }> = ({ outroStart, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pct = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const opacity = interpolate(
    frame,
    [outroStart - fps * 0.3, outroStart + fps * 0.3],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", opacity, pointerEvents: "none" }}>
      <div style={{ height: 6, width: "100%", background: "rgba(255,255,255,0.12)" }}>
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.92))`,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Discreet watermark, bottom center — fades out under the outro card.
// ---------------------------------------------------------------------------
const Watermark: React.FC<{ text: string; outroStart: number }> = ({ text, outroStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [outroStart - fps * 0.3, outroStart + fps * 0.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 56, opacity }}>
      <div
        style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontWeight: 700,
          fontSize: 30,
          color: "rgba(255,255,255,0.9)",
          padding: "8px 18px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.32)",
          letterSpacing: 0.5,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
