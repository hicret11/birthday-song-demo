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
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-5 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,72,153,0.20),transparent_55%),radial-gradient(circle_at_88%_72%,rgba(245,158,11,0.14),transparent_55%)]"
      />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-7 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
            <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-amber-400 text-lg font-black shadow-lg">
              ♪
            </span>
            Sing My Birthday
          </Link>
          <a
            href="/api/auth/logout"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:text-white"
          >
            Sign out
          </a>
        </div>

        <h1 className="text-2xl font-black tracking-tight">Your songs</h1>
        <p className="mt-1 text-sm text-slate-400">Signed in as {email}</p>

        {songs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
            <p className="text-lg font-bold">No songs here yet 🎵</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">
              Songs you create with this email will show up here. Make your first one — it takes
              about a minute.
            </p>
            <Link
              href="/generate"
              className="mt-5 inline-block rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-6 py-3 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-0.5"
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
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-fuchsia-300/30"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pink-500/30 to-amber-400/20 text-2xl">
                    🎂
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">Happy Birthday, {song.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {song.genre} · {song.language}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
                      song.unlocked
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-fuchsia-400/15 text-fuchsia-200"
                    }`}
                  >
                    {song.unlocked ? "Unlocked" : "Preview"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          You don&rsquo;t need an account to make or buy a song — this is just so you can find them
          again.
        </p>
      </div>
    </main>
  );
}
