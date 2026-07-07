"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";

export default function LandingCta({
  label = "Create a Free Birthday Song",
}: {
  label?: string;
}) {
  return (
    <Link
      href="/generate"
      onClick={() => track("landing_cta_click")}
      className="inline-flex items-center justify-center rounded-full bg-jade px-9 py-4 text-lg font-extrabold tracking-tight text-white shadow-[0_16px_40px_-12px_rgba(31,142,125,0.7)] transition hover:-translate-y-0.5 hover:bg-jade-deep sm:text-xl"
    >
      {label}
    </Link>
  );
}
