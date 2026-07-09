// Internal preview of the Premiere reveal — a review surface for the reveal
// component in the real app with real audio (the sample at /_test/full.mp3 gives
// the Web-Audio equalizer a same-origin source to react to). It renders the SAME
// localized copy the shipping reveal uses (via /share/[id]); this route is not
// linked from the product and is kept out of search engines.
//
// Visit /premiere?name=Maya&from=Mom to preview with your own values.

import type { Metadata } from "next";
import PremiereClient from "./PremiereClient";
import { resolveLocale } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Not a user-facing marketing page — never index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PremierePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const locale = await resolveLocale().catch(() => DEFAULT_LOCALE);
  const name = pick(sp.name) || "Maya";
  const from = pick(sp.from) || "Mom";
  const title = pick(sp.title) || "Your Day, Your Light";
  // Same-origin sample so AnalyserNode can read frequency data.
  const audio = pick(sp.audio) || "/_test/full.mp3";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#120b16] px-4 py-10">
      <div className="w-full">
        <PremiereClient
          recipientName={name}
          directorName={from}
          songTitle={title}
          audioSrc={audio}
          locale={locale}
        />
      </div>
    </main>
  );
}
