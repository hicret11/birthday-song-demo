import { after } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShareTemplateView } from "@/components/share/templates";
import { requestPremiumRender } from "@/lib/render-video";
import { loadSharedSong, markSharedSongUnlocked } from "@/lib/share";
import { toPublicSong } from "@/lib/public-song";
import { listApprovedContributions } from "@/lib/crowd";
import { getStripe } from "@/lib/stripe";
import JsonLd from "@/components/JsonLd";
import TrackShareView from "./TrackShareView";
import { CrowdCreditProvider, type CrowdCredit } from "@/components/share/CrowdCreditContext";
import CastAddOn from "@/components/cast/CastAddOn";
import LiveCastAddOn from "@/components/cast/LiveCastAddOn";
import { getLiveCities, isLiveCastEnabled, liveDepositUsd } from "@/lib/cast/live";
import { getDictionary, isRtl, type Locale } from "@/lib/i18n";

const SITE_URL = "https://singmybirthday.com";

// Song language (full name) → dictionary locale, mirroring CrowdPremiere / join.
const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
};

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
  // Personalized social-share card. A rich, name-specific preview gets 2–3x more
  // clicks when the link is shared on WhatsApp/Telegram/social — the main way
  // these songs spread. Falls back to the static branded /og-image.png.
  const title = `🎂 Happy Birthday, ${song.name}!`;
  const description = `Listen to ${song.name}'s personalized ${song.genre} birthday song — made with Sing My Birthday.`;
  const url = `/share/${song.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "music.song",
      siteName: "Sing My Birthday",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { unlocked: unlockedParam, session_id: sessionIdParam } = await searchParams;
  let song = await loadSharedSong(id);
  if (!song) notFound();

  // Payment→unlock race fallback: the async Stripe webhook flips the song to
  // unlocked, but the success redirect can beat it, leaving a paying buyer on
  // the paywall. When Stripe hands us back a session_id and the song still reads
  // locked, verify the session server-side and unlock immediately. The webhook
  // remains the durable backup; this just removes the timing dependency.
  // Best-effort — any failure falls through to rendering the song as-is.
  const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam;
  if (song && !song.unlocked && typeof sessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (
        session.payment_status === "paid" &&
        session.metadata?.kind === "song_unlock" &&
        session.metadata?.share_id === id
      ) {
        await markSharedSongUnlocked(id, session.metadata.plan === "deluxe" ? "deluxe" : "full");
        song = (await loadSharedSong(id)) ?? song;
        // Kick the premium Remotion render on this verify-path unlock too, so a
        // buyer who lands here before the webhook fires still gets it started.
        // Non-blocking via after(); no-op unless RENDER_WORKER_URL is set.
        // requestPremiumRender is idempotent (reuses persisted captions/status).
        if (song.unlocked) {
          const unlockedSong = song;
          after(requestPremiumRender(unlockedSong).catch(() => undefined));
        }
      }
    } catch {
      // Verification failed (network, expired session, Stripe error) — proceed
      // with the song as-is. Never crash the share page; the webhook still runs.
    }
  }

  const justUnlocked = !!song.unlocked && unlockedParam === "1";

  // Crowd-song credit: for a merged group song, fetch the approved contributions
  // (Postgres) so the template's Premiere can frame it as "a song from N people"
  // and credit the contributors by name. Best-effort — a failure just renders
  // the reveal without the credit. Non-crowd shares skip this entirely.
  let crowdCredit: CrowdCredit | null = null;
  if (song.crowd?.status === "merged") {
    const contributions = await listApprovedContributions(id).catch(() => []);
    const names = Array.from(
      new Set(
        contributions
          .map((c) => c.authorName?.trim())
          .filter((n): n is string => !!n),
      ),
    );
    crowdCredit = { count: contributions.length, contributors: names };
  }

  const castLocale = LANGUAGE_TO_LOCALE[song.language] ?? "en";
  const castDictAll = getDictionary(castLocale);
  const castDict = castDictAll.cast;
  const castDir = isRtl(castLocale) ? "rtl" : "ltr";
  // Live cast is a concierge pilot — only offered where CAST_LIVE_CITIES is set.
  const liveEnabled = isLiveCastEnabled();
  const liveCities = getLiveCities();
  const liveDeposit = liveDepositUsd();

  const musicRecording = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: `Happy Birthday, ${song.name}`,
    url: `${SITE_URL}/share/${song.id}`,
    inLanguage: song.language,
    byArtist: {
      "@type": "Organization",
      name: "Sing My Birthday",
      url: SITE_URL,
    },
  };

  return (
    <>
      <JsonLd data={musicRecording} />
      <TrackShareView
        venue_slug={song.venueSlug ?? null}
        share_id={song.id}
        recipient_name={song.name}
        language={song.language}
        genre={song.genre}
      />
      {justUnlocked && (
        <div className="fixed inset-x-0 top-0 z-50 bg-jade px-4 py-3 text-center text-sm font-extrabold text-white shadow-lg">
          🎉 Unlocked! The full song is yours.
        </div>
      )}
      {/* Paywall enforcement: a locked song's client payload is stripped of all
          full-media URLs. A non-paying visitor only ever receives lyrics +
          metadata; audio comes solely from the gated 15s preview route. */}
      {crowdCredit ? (
        <CrowdCreditProvider value={crowdCredit}>
          <ShareTemplateView song={toPublicSong(song)} />
        </CrowdCreditProvider>
      ) : (
        <ShareTemplateView song={toPublicSong(song)} />
      )}
      {/* Add-on entry point — an independent upsell that never touches the song,
          the paywall, or unlock state. */}
      <CastAddOn
        giftId={song.id}
        recipientName={song.name}
        language={song.language}
        t={castDict}
        dir={castDir}
      />
      {liveEnabled && (
        <LiveCastAddOn
          giftId={song.id}
          recipientName={song.name}
          cities={liveCities}
          depositUsd={liveDeposit}
          t={castDictAll.castLive}
          dir={castDir}
        />
      )}
    </>
  );
}
