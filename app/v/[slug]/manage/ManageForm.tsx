"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "sent" | "error";

type Props = {
  slug: string;
  brand: string;
};

export default function ManageForm({ slug, brand }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() !== "" && status !== "submitting" && status !== "sent";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/venue/portal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email.trim() }),
      });
      // Intentionally identical UX on hit/miss — server never reveals
      // whether the email matches.
      if (res.ok) {
        setStatus("sent");
        return;
      }
      setStatus("error");
      setError("Couldn't send the link. Please try again.");
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please check your connection.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-sand bg-cream-soft p-4 text-sm">
        <p className="font-semibold text-jade">Check your email.</p>
        <p className="mt-1 text-ink-soft">
          If the address matches the one on file, we&apos;ll send a one-time link in a minute. It expires in 30 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <label htmlFor="manage-email" className="block text-sm font-bold">
        Email on the account
      </label>
      <input
        id="manage-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        disabled={status === "submitting"}
        className="w-full rounded-2xl border border-sand bg-cream-soft px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-jade focus:ring-1 focus:ring-jade disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!canSubmit}
        style={{ backgroundColor: brand }}
        className="w-full rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "submitting" ? "Sending…" : "Send me the link"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-blush">
          {error}
        </p>
      )}
    </form>
  );
}
