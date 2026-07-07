import { redirect } from "next/navigation";
import Link from "next/link";
import type { SharedSong } from "@/lib/api-types";
import { getUserEmail } from "@/lib/user-session";
import { listUserSongIds } from "@/lib/user-songs";
import { loadSharedSong } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MySongsPage() {
  const email = await getUserEmail();
  if (!email) redirect("/login");

  const ids = await listUserSongIds(email);
  const loaded = await Promise.all(ids.map((id) => loadSharedSong(id).catch(() => null)));
  const songs = loaded.filter((s): s is SharedSong => Boolean(s));

  return (
    <main className="grain relative min-h-screen overflow-hidden bg-cream px-5 py-10 text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-7 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
            <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl bg-warm-gradient text-lg font-black text-white shadow-md">
              ♪
            </span>
            Sing My Birthday
          </Link>
          <a
            href="/api/auth/logout"
            className="rounded-full border border-sand bg-cream-soft px-4 py-2 text-xs font-bold text-ink-soft transition hover:text-ink"
          >
            Sign out
          </a>
        </div>

        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Your <span className="font-serif italic font-normal text-jade">songs</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">Signed in as {email}</p>

        {songs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-sand bg-cream-soft p-8 text-center shadow-sm">
            <p className="font-display text-lg font-bold text-ink">No songs here yet 🎵</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
              Songs you create with this email will show up here. Make your first one — it takes
              about a minute.
            </p>
            <Link
              href="/generate"
              className="mt-5 inline-block rounded-full bg-jade px-6 py-3 text-sm font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 hover:bg-jade-deep"
            >
              Make a birthday song →
            </Link>
          </div>
        ) : (
          <ul className="mt-7 space-y-3">
            {songs.map((song) => (
              <li key={song.id}>
                <Link
                  href={`/share/${song.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-sand bg-cream-soft p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-jade"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-warm-gradient text-2xl">
                    🎂
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display font-bold text-ink">Happy Birthday, {song.name}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {song.genre} · {song.language}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
                      song.unlocked
                        ? "bg-jade/15 text-jade"
                        : "bg-blush/15 text-blush"
                    }`}
                  >
                    {song.unlocked ? "Unlocked" : "Preview"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-xs text-ink-soft">
          You don&rsquo;t need an account to make or buy a song — this is just so you can find them
          again.
        </p>
      </div>
    </main>
  );
}
