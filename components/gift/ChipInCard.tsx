"use client";

// Group split payment ("chip in") — the contributor-facing card on /join.
//
// Shows how much of the gift's price has been pooled so far ("$18 of $30 — 3
// friends chipped in") and lets a friend add their share. On submit it opens a
// one-time Stripe Checkout via POST /api/gift/[id]/chip-in and redirects. When
// the pool reaches the price the server unlocks the song (shared webhook path).
//
// Rendered only when GROUP_PAY_ENABLED is on (the /join server component gates
// it). Independent of the song's media — it only ever knows the pool total.

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type GroupPayDict = Dict["groupPay"];

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** USD cents → "$9" / "$9.99" (drops a trailing ".00"). */
function fmtUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export default function ChipInCard({
  giftId,
  recipientName,
  t,
  dir,
  targetCents,
  paidCents,
  count,
  funded,
}: {
  giftId: string;
  recipientName: string;
  t: GroupPayDict;
  dir: "ltr" | "rtl";
  targetCents: number;
  paidCents: number;
  count: number;
  funded: boolean;
}) {
  const remainingCents = Math.max(targetCents - paidCents, 0);
  const isFunded = funded || remainingCents === 0;
  const pct = Math.min(100, Math.round((paidCents / Math.max(targetCents, 1)) * 100));

  const minCents = 100;
  // Default the input to whatever still needs covering (at least the minimum).
  const defaultDollars = (Math.max(remainingCents, minCents) / 100).toFixed(2);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultDollars);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(amount) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents >= minCents;

  async function submit() {
    setError(null);
    if (!amountValid) {
      setError(fill(t.errAmount, { min: fmtUsd(minCents) }));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/gift/${giftId}/chip-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: { message?: string };
      };
      if (!res.ok || !data.url) {
        setError(data.error?.message ?? t.errGeneric);
        setSubmitting(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError(t.errNetwork);
      setSubmitting(false);
    }
  }

  const friendsLine =
    count <= 0
      ? t.noneYet
      : fill(count === 1 ? t.friendsOne : t.friendsMany, { count });

  return (
    <section dir={dir} className="mx-auto mt-6 w-full max-w-[540px]">
      <div className="rounded-3xl border border-sand bg-cream-soft p-5 shadow-sm">
        <h2 className="font-display text-lg font-black text-ink">{t.title}</h2>
        {!isFunded && (
          <p className="mt-1 text-sm text-ink-soft">
            {fill(t.subtitle, { name: recipientName })}
          </p>
        )}

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-base font-black text-ink">
              {fill(t.progress, { paid: fmtUsd(paidCents), total: fmtUsd(targetCents) })}
            </span>
            <span className="text-xs font-semibold text-ink-soft">{friendsLine}</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full bg-jade hover:bg-jade-deep transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {isFunded ? (
          <p className="mt-4 text-sm font-bold text-jade">{t.funded}</p>
        ) : (
          <>
            <p className="mt-2 text-xs font-semibold text-ink-soft">
              {fill(t.remaining, { amount: fmtUsd(remainingCents) })}
            </p>

            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-4 w-full rounded-2xl bg-jade hover:bg-jade-deep px-6 py-3 text-base font-extrabold text-white shadow-lg transition hover:-translate-y-0.5"
              >
                {t.open}
              </button>
            ) : (
              <div className="mt-4">
                <label className="block text-xs font-bold text-ink">{t.amountLabel}</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-base font-bold text-ink-soft">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-sand bg-cream px-4 py-3 text-base text-ink outline-none focus:border-jade"
                  />
                  {remainingCents >= minCents && (
                    <button
                      type="button"
                      onClick={() => setAmount((remainingCents / 100).toFixed(2))}
                      className="shrink-0 rounded-full border border-sand bg-cream px-3 py-2 text-xs font-bold text-ink hover:border-jade"
                    >
                      {fill(t.coverRest, { amount: fmtUsd(remainingCents) })}
                    </button>
                  )}
                </div>

                {error && <p className="mt-3 text-sm font-semibold text-jade">{error}</p>}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !amountValid}
                  className="mt-4 w-full rounded-2xl bg-jade hover:bg-jade-deep px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {submitting
                    ? t.submitting
                    : fill(t.submit, { amount: amountValid ? fmtUsd(amountCents) : "" })}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-2 w-full text-center text-xs font-semibold text-ink-soft underline"
                >
                  {t.close}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
