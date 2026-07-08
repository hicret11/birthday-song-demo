"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "./actions";

const TABS: [string, string][] = [
  ["/admin/generations", "Events"],
  ["/admin/captures", "Captures"],
  ["/admin/shares", "Shares"],
  ["/admin/live", "Live Cast"],
  ["/admin/content-packages", "Content Packages"],
  ["/admin/social", "Social"],
  ["/admin/outreach", "Outreach"],
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="flex items-center gap-1 px-4">
        <span className="mr-3 select-none py-3 text-sm font-semibold tracking-tight text-neutral-200">
          🎂 SMB <span className="text-neutral-500">Admin</span>
        </span>
        <nav className="flex items-stretch gap-0.5">
          {TABS.map(([href, label]) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={
                  "border-b-2 px-3 py-3 text-sm transition-colors " +
                  (active
                    ? "border-fuchsia-500 font-semibold text-white"
                    : "border-transparent text-neutral-400 hover:text-neutral-200")
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="ml-auto">
          <button
            type="submit"
            className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
