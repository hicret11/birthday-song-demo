"use client";

// The Premiere reveal for EVERY delivered song — not just crowd songs.
//
// This replaces the flat audio player as the default recipient deliverable: the
// stage darkens, curtains part, the star's name lands in lights, their song
// plays, the director's private note is revealed as the closing beat, and a
// credits roll names the director (and, for a crowd song, everyone who
// contributed).
//
// Paywall: `audioSrc` is passed already resolved with the SAME locked/unlocked
// rule the flat player uses (locked → the gated /api/share/[id]/preview clip,
// unlocked → the full proxied track). This component never sees a full-media
// URL for a locked song. The director's note is the buyer's own message, so it
// is shown in the reveal regardless of lock state.

import PremiereReveal from "@/components/premiere/PremiereReveal";
import { getDictionary, type Locale } from "@/lib/i18n";
import { useCrowdCredit } from "./CrowdCreditContext";

const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
};

export function SharePremiere({
  recipientName,
  directorName,
  songTitle,
  audioSrc,
  videoSrc,
  language,
  directorNote,
  isCrowd,
  onFirstPlay,
}: {
  recipientName: string;
  /** The director credit shown in the titles ("your partner", a name…). */
  directorName?: string;
  songTitle: string;
  audioSrc: string;
  /** Rendered premiere video (unlocked) — plays on the stage screen when set. */
  videoSrc?: string;
  language: string;
  /** Closing message — text and/or a recorded voice clip. */
  directorNote?: { text?: string; voiceUrl?: string; voiceDurationSec?: number };
  /** When true, use the "a song from N people" crowd framing at the peak. */
  isCrowd?: boolean;
  /** Fired once when the recipient first starts the premiere (playback begins). */
  onFirstPlay?: () => void;
}) {
  const credit = useCrowdCredit();
  const count = credit?.count ?? 0;
  const contributors = credit?.contributors ?? [];

  const t = getDictionary(LANGUAGE_TO_LOCALE[language] ?? "en");

  // Crowd songs get the "a song from N people who love you" overline at the
  // reveal peak; solo songs get the standard one-night-only marquee overline.
  const marqueeOverline = isCrowd
    ? count >= 2
      ? `${t.crowd.premiereOverlinePrefix}${count}${t.crowd.premiereOverlineSuffix}`
      : t.crowd.premiereOverlineSolo
    : t.premiere.marqueeOverline;

  return (
    <div className="mt-6">
      <PremiereReveal
        recipientName={recipientName}
        directorName={directorName}
        songTitle={songTitle}
        audioSrc={audioSrc}
        videoSrc={videoSrc}
        directorNote={directorNote}
        onFirstPlay={onFirstPlay}
        contributors={isCrowd ? contributors : undefined}
        labels={{
          overline: t.premiere.overline,
          introPrefix: t.premiere.introPrefix,
          introSuffix: t.premiere.introSuffix,
          openCta: t.premiere.openCta,
          marqueeOverline,
          pause: t.premiere.pause,
          replay: t.premiere.replay,
          director: t.premiere.director,
          noteLabel: t.premiere.noteLabel,
          notePlay: t.premiere.notePlay,
          notePause: t.premiere.notePause,
          starringLabel: t.premiere.starringLabel,
          producedByLabel: t.premiere.producedByLabel,
          withLoveLabel: t.premiere.withLoveLabel,
        }}
      />
    </div>
  );
}
