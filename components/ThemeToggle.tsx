"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark theme switch. Toggles the `dark` class on <html> (which swaps the
 * CSS color tokens in globals.css) and persists the choice in localStorage. The
 * initial class is set by the inline no-flash script in the root layout, so this
 * only needs to reflect + update it.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Read the real theme from the DOM after mount. It's set client-side by the
    // no-flash script, so reading it during render would desync hydration — the
    // effect deliberately renders the default first, then reconciles once.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time sync from a client-only DOM value; render-time read would break hydration
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    // Briefly enable color transitions so the theme cross-fades instead of
    // snapping. Removed after the fade so it never affects normal interactions.
    el.classList.add("theme-transition");
    window.setTimeout(() => el.classList.remove("theme-transition"), 350);
    el.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore storage errors (private mode, etc.)
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-10 w-10 place-items-center rounded-full border border-sand bg-cream-soft text-ink-soft shadow-sm transition hover:text-ink"
    >
      {dark ? <Sun size={18} strokeWidth={2.2} /> : <Moon size={18} strokeWidth={2.2} />}
    </button>
  );
}
