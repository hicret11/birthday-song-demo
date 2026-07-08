// Crowd-magic contributor page — the "secret link" experience.
//
// A friend/family member opens /join/[id] and adds a line, a memory, or a wish.
// All the bits are woven into ONE song so the birthday person feels loved by
// their whole circle. This page shows ONLY safe data (recipient first name +
// approved contributions) — never the gift's media or paywall state.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadSharedSong } from "@/lib/share";
import { listApprovedContributions } from "@/lib/crowd";
import {
  isGroupPayEnabled,
  giftPoolTargetCents,
  getChipInProgress,
} from "@/lib/group-pay";
import { getDictionary, isRtl, type Locale } from "@/lib/i18n";
import JoinClient from "./JoinClient";
import ChipInCard from "@/components/gift/ChipInCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Song language (a full name like "Spanish") → dictionary locale, mirroring
// CrowdPremiere. Languages without a dictionary fall back to English copy.
const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
};

/** Fill {placeholder} tokens in a dictionary string. */
function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const song = await loadSharedSong(id).catch(() => null);
  const t = getDictionary(LANGUAGE_TO_LOCALE[song?.language ?? "English"] ?? "en").crowdContributor;
  const name = song?.name?.trim() || t.fallbackName;
  return {
    title: fill(t.metaTitle, { name }),
    description: fill(t.metaDescription, { name }),
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song = await loadSharedSong(id);
  if (!song) notFound();

  const initial = await listApprovedContributions(id);

  const locale = LANGUAGE_TO_LOCALE[song.language] ?? "en";
  const dict = getDictionary(locale);
  const t = dict.crowdContributor;
  const dir = isRtl(locale) ? "rtl" : "ltr";

  // Group split payment ("chip in") — off by default (GROUP_PAY_ENABLED). When
  // on, read the pool progress so friends can chip in toward the unlock price.
  let chipInSlot: React.ReactNode = null;
  if (isGroupPayEnabled()) {
    const target = giftPoolTargetCents(song);
    const { paidCents, count } = await getChipInProgress(id);
    chipInSlot = (
      <ChipInCard
        giftId={id}
        recipientName={song.name}
        t={dict.groupPay}
        dir={dir}
        targetCents={target}
        paidCents={paidCents}
        count={count}
        funded={!!song.unlocked}
      />
    );
  }

  return (
    <JoinClient
      giftId={id}
      recipientName={song.name}
      t={t}
      dir={dir}
      initialContributions={initial.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        kind: c.kind,
        content: c.content,
        contentUrl: c.contentUrl,
      }))}
      chipInSlot={chipInSlot}
    />
  );
}
