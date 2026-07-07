"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

// Routes that render their own ThemeToggle inside a bespoke header, so the
// floating global one would double up there.
const HAS_OWN_TOGGLE = new Set<string>(["/", "/generate"]);

/**
 * Renders a floating light/dark switch in the top-right on every page that
 * doesn't already place its own. Mounted once in the root layout so the toggle
 * is available site-wide (legal pages, venue, onboarding, share, etc.).
 */
export default function GlobalThemeToggle() {
  const pathname = usePathname();
  if (pathname && HAS_OWN_TOGGLE.has(pathname)) return null;
  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>
  );
}
