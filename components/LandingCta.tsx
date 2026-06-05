"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";

export default function LandingCta() {
  return (
    <Link
      href="/generate"
      onClick={() => track("landing_cta_click")}
      className="inline-flex items-center justify-center rounded-2xl bg-brand px-10 py-5 text-lg font-extrabold text-white shadow-2xl shadow-fuchsia-500/30 transition hover:-translate-y-1 hover:shadow-fuchsia-500/50 sm:text-xl"
    >
      Create a Free Birthday Song
    </Link>
  );
}
