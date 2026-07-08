"use client";

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-sand bg-cream px-4 py-6 text-sm text-ink-soft">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <Link className="font-semibold hover:text-ink" href="/become-a-venue">
          For Venues
        </Link>
        <Link className="font-semibold hover:text-ink" href="/terms">
          Terms
        </Link>
        <Link className="font-semibold hover:text-ink" href="/privacy">
          Privacy
        </Link>
        <Link className="font-semibold hover:text-ink" href="/refund">
          Refunds
        </Link>
        <Link className="font-semibold hover:text-ink" href="/cookies">
          Cookies
        </Link>
        <button
          type="button"
          className="font-semibold hover:text-ink"
          onClick={() => window.dispatchEvent(new Event("smb:open-cookie-preferences"))}
        >
          Cookie Preferences
        </button>
      </nav>
    </footer>
  );
}
