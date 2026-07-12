"use client";

// The crowd-song reveal on the share page. Replaces the flat player for a merged
// crowd song (song.crowd.status === "merged") with the theatrical Premiere,
// framed as a gift from many: an overline "A song from {N} people who love you"
// at the reveal peak, and the contributor names credited below.
//
// Paywall: audioSrc is passed in already resolved with the SAME locked/unlocked
// rule the flat player uses — locked → the gated /api/share/[id]/preview clip
// (self-caps ~24s, so no previewSeconds cap here), unlocked → the full proxied
// track. This component never sees a full-media URL for a locked song.

import PremiereReveal from "@/components/premiere/PremiereReveal";
import { getDictionary, type Locale } from "@/lib/i18n";
import { useCrowdCredit } from "./CrowdCreditContext";

// Song language (a full name like "Spanish") → dictionary locale. Languages
// without a dictionary (French, Hindi, Russian) fall back to English copy.
const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
};

const MAX_SHOWN_NAMES = 8;

export function CrowdPremiere({
  recipientName,
  directorName,
  songTitle,
  audioSrc,
  language,
}: {
  recipientName: string;
  directorName?: string;
  songTitle: string;
  audioSrc: string;
  language: string;
}) {
  const credit = useCrowdCredit();
  const count = credit?.count ?? 0;
  const names = credit?.contributors ?? [];

  const t = getDictionary(LANGUAGE_TO_LOCALE[language] ?? "en");

  // "A song from N people who love you" for a real group; a warm generic line
  // when there's only one (or zero) contributor so we never print "1 people".
  const overline =
    count >= 2
      ? `${t.crowd.premiereOverlinePrefix}${count}${t.crowd.premiereOverlineSuffix}`
      : t.crowd.premiereOverlineSolo;

  const shown = names.slice(0, MAX_SHOWN_NAMES);
  const truncated = names.length > shown.length || count > names.length;
  const namesLine = shown.join(", ") + (truncated ? "…" : "");

  return (
    <div className="mt-6">
      <PremiereReveal
        recipientName={recipientName}
        directorName={directorName}
        songTitle={songTitle}
        audioSrc={audioSrc}
        labels={{
          overline: t.premiere.overline,
          introPrefix: t.premiere.introPrefix,
          introSuffix: t.premiere.introSuffix,
          openCta: t.premiere.openCta,
          // The crowd framing lands at the reveal peak, above the star's name.
          marqueeOverline: overline,
          pause: t.premiere.pause,
          replay: t.premiere.replay,
          director: t.premiere.director,
        }}
      />
      {shown.length > 0 && (
        <p className="mt-4 text-center text-sm text-ink-soft">
          {t.crowd.withLove}{" "}
          <span className="font-semibold text-ink">{namesLine}</span>
        </p>
      )}
    </div>
  );
}
