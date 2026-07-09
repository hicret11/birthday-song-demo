"use client";

// Thin client wrapper so the server page can pass data while we attach a
// client-side onContinue handler (functions can't cross the server boundary).
// Uses the SAME localized `labels` the shipping reveal uses (see SharePremiere),
// so the preview never falls back to placeholder copy.

import PremiereReveal, {
  type PremiereRevealProps,
} from "@/components/premiere/PremiereReveal";
import { getDictionary, type Locale } from "@/lib/i18n";

export default function PremiereClient({
  locale = "en",
  ...props
}: Omit<PremiereRevealProps, "onContinue" | "labels" | "continueLabel"> & {
  locale?: Locale;
}) {
  const t = getDictionary(locale);

  return (
    <PremiereReveal
      {...props}
      continueLabel={t.premiere.continueLabel}
      labels={{
        overline: t.premiere.overline,
        introPrefix: t.premiere.introPrefix,
        introSuffix: t.premiere.introSuffix,
        openCta: t.premiere.openCta,
        marqueeOverline: t.premiere.marqueeOverline,
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
      onContinue={() => {
        // Preview-only: in the real flow this advances to the share/send step.
        alert(`Preview: in the real flow this opens sending ${props.recipientName}’s song.`);
      }}
    />
  );
}
