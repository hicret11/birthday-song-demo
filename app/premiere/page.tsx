// Live preview of the reimagined Premiere reveal (Phase 1 centerpiece).
//
// Visit /premiere?name=Майя&from=мама to see it in the real app with real audio.
// Uses the local sample at /_test/full.mp3 (present in dev) as a same-origin
// source so the Web-Audio equalizer reacts to actual sound. This route is a
// review surface for the moment before it's wired into the generator flow.

import PremiereClient from "./PremiereClient";

export const dynamic = "force-dynamic";

export default async function PremierePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const name = pick(sp.name) || "Майя";
  const from = pick(sp.from) || "мама";
  const title = pick(sp.title) || "Твой день, твой свет";
  // Same-origin sample so AnalyserNode can read frequency data.
  const audio = pick(sp.audio) || "/_test/full.mp3";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#120b16] px-4 py-10">
      <div className="w-full">
        <p className="mb-6 text-center text-[11px] uppercase tracking-[0.24em] text-amber-200/50">
          Sing My Birthday · Premiere (Phase 1 preview)
        </p>
        <PremiereClient
          recipientName={name}
          directorName={from}
          songTitle={title}
          audioSrc={audio}
        />
        <p className="mx-auto mt-8 max-w-[440px] text-center text-xs leading-relaxed text-amber-200/35">
          Подсказка: попробуй <code>/premiere?name=Лео&amp;from=лучший друг</code>.
          В реальном flow сюда придёт настоящая песня через same-origin
          audio-proxy, и эквалайзер оживёт под неё.
        </p>
      </div>
    </main>
  );
}
