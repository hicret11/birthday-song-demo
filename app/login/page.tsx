"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginInner() {
  const params = useSearchParams();
  const initialError =
    params.get("error") === "expired"
      ? "That link expired or was already used. Enter your email for a fresh one."
      : params.get("error") === "config"
        ? "Sign-in isn't fully configured yet. Please try again later."
        : null;

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(initialError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) setSent(true);
      else setErr(data?.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setErr("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#070019] via-[#12062f] to-[#1e1646] px-5 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(236,72,153,0.20),transparent_55%),radial-gradient(circle_at_88%_72%,rgba(245,158,11,0.14),transparent_55%)]"
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl">
        <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-black tracking-tight">
          <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-amber-400 text-lg font-black shadow-lg">
            ♪
          </span>
          Sing My Birthday
        </Link>

        {sent ? (
          <div>
            <h1 className="text-xl font-extrabold">Check your email 📬</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              If <span className="font-semibold text-white">{email}</span> has any songs, we just
              sent a sign-in link. Click it to see them — it works on any device.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-5 text-xs text-fuchsia-300 underline-offset-2 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-xl font-extrabold">See your songs</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
              Enter your email and we&rsquo;ll send a one-tap sign-in link. No password — and you
              don&rsquo;t need an account to make or buy a song.
            </p>
            {err && (
              <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {err}
              </p>
            )}
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/30"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending…" : "Email me a sign-in link →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
