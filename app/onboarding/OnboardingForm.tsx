"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

type Props = {
  sessionId: string;
  defaultName: string;
};

export default function OnboardingForm({ sessionId, defaultName }: Props) {
  const [venueName, setVenueName] = useState(defaultName);
  const [logoColor, setLogoColor] = useState("#a855f7");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  const canSubmit = venueName.trim() !== "" && /^#[0-9a-fA-F]{6}$/.test(logoColor) && status !== "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setMessage(null);

    try {
      const res = await fetch("/api/venues/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          venue_name: venueName.trim(),
          logo_color: logoColor,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.slug) {
        setSlug(data.slug);
        setStatus("success");
        setMessage(
          data.alreadyOnboarded
            ? "You're already onboarded. Here's your link."
            : "Done. Your branded link is below.",
        );
        return;
      }

      setStatus("error");
      setMessage(data?.error?.message ?? "Couldn't save. Please try again.");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please check your connection.");
    }
  }

  if (slug) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-emerald-300">{message}</p>
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Your branded link</p>
          <p className="mt-1 font-mono text-sm break-all">/v/{slug}</p>
        </div>
        <p className="text-xs text-gray-400">
          The /v/[slug] page itself is still being built — once it ships, this URL is live.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="venue-name" className="mb-2 block text-sm font-bold">
          Venue name
        </label>
        <input
          id="venue-name"
          type="text"
          required
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="The Velvet Room"
          maxLength={80}
          disabled={status === "submitting"}
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-purple-400 disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="logo-color" className="mb-2 block text-sm font-bold">
          Logo color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="logo-color"
            type="color"
            value={logoColor}
            onChange={(e) => setLogoColor(e.target.value)}
            disabled={status === "submitting"}
            className="h-12 w-16 cursor-pointer rounded-2xl border border-white/20 bg-white/10 p-1 disabled:opacity-60"
            aria-label="Logo color"
          />
          <input
            type="text"
            value={logoColor}
            onChange={(e) => setLogoColor(e.target.value)}
            disabled={status === "submitting"}
            pattern="^#[0-9a-fA-F]{6}$"
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-sm uppercase outline-none transition focus:ring-2 focus:ring-purple-400 disabled:opacity-60"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 py-4 text-base font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {status === "submitting" ? "Saving…" : "Generate my branded link"}
      </button>

      {message && status === "error" && (
        <p role="alert" className="text-sm text-rose-300">{message}</p>
      )}
    </form>
  );
}
