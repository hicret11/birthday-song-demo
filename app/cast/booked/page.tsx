// Cast-booking confirmation — Stripe success_url lands here after payment.
//
// The Stripe webhook (checkout.session.completed / kind=cast_booking) is the
// durable path that flips the booking to "scheduled"; this page is just the
// friendly landing. It loads the booking to personalize + localize the thank
// you, and never mutates anything.

import Link from "next/link";
import type { Metadata } from "next";
import { getBooking } from "@/lib/cast";
import { getDictionary, isRtl, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  English: "en",
  Spanish: "es",
  Turkish: "tr",
  Arabic: "ar",
};

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false },
};

export default async function CastBookedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const bookingIdRaw = Array.isArray(sp.booking) ? sp.booking[0] : sp.booking;
  const bookingId = typeof bookingIdRaw === "string" && UUID_RE.test(bookingIdRaw) ? bookingIdRaw : null;

  const booking = bookingId ? await getBooking(bookingId).catch(() => null) : null;
  const locale = LANGUAGE_TO_LOCALE[booking?.language ?? "English"] ?? "en";
  const t = getDictionary(locale).cast;
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const name = booking?.recipientName?.trim() || "";
  const backHref = booking?.giftId ? `/share/${booking.giftId}` : "/";

  return (
    <main dir={dir} className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-[440px] rounded-3xl border border-sand bg-cream-soft p-8 text-center shadow-sm">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-3 font-display text-2xl font-black">{t.bookedTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {fill(t.bookedBody, { name })}
        </p>
        <div className="mt-4 rounded-2xl border border-sand bg-cream px-4 py-3 text-left">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
            {t.disclosureTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.disclosure}</p>
        </div>
        <Link
          href={backHref}
          className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-brand-amber to-brand-pink px-6 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {t.bookedHome}
        </Link>
      </div>
    </main>
  );
}
