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
    <main className="grain relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-5 text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,158,120,0.5),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,126,157,0.45),transparent_66%)] blur-2xl"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-sand bg-cream-soft p-7 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
          <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl bg-warm-gradient text-lg font-black text-white shadow-md">
            ♪
          </span>
          Sing My Birthday
        </Link>

        {sent ? (
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">Check your email 📬</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              If <span className="font-semibold text-ink">{email}</span> has any songs, we just
              sent a sign-in link. Click it to see them — it works on any device.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-5 text-xs font-semibold text-jade underline-offset-2 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">
              See your <span className="font-serif italic font-normal text-jade">songs</span>
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Enter your email and we&rsquo;ll send a one-tap sign-in link. No password — and you
              don&rsquo;t need an account to make or buy a song.
            </p>
            {err && (
              <p className="mt-4 rounded-xl border border-blush/40 bg-blush/10 px-3 py-2 text-xs text-blush">
                {err}
              </p>
            )}
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl border border-sand bg-cream-soft px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-jade focus:ring-2 focus:ring-jade/25"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-full bg-jade py-3.5 text-sm font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 hover:bg-jade-deep disabled:cursor-not-allowed disabled:opacity-50"
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
