"use client";

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <Link className="font-semibold hover:text-gray-950" href="/become-a-venue">
          For Venues
        </Link>
        <Link className="font-semibold hover:text-gray-950" href="/terms">
          Terms
        </Link>
        <Link className="font-semibold hover:text-gray-950" href="/privacy">
          Privacy
        </Link>
        <Link className="font-semibold hover:text-gray-950" href="/cookies">
          Cookies
        </Link>
        <button
          type="button"
          className="font-semibold hover:text-gray-950"
          onClick={() => window.dispatchEvent(new Event("smb:open-cookie-preferences"))}
        >
          Cookie Preferences
        </button>
      </nav>
    </footer>
  );
}
