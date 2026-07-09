"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const canSubmit = email.trim() !== "" && birthday !== "" && isAdult && status !== "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("submitting");
    setMessage(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), birthday }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus("success");
        setMessage("You're on the list. We'll be in touch.");
        setEmail("");
        setBirthday("");
        setIsAdult(false);
        return;
      }

      if (res.status === 409) {
        setStatus("duplicate");
        setMessage("You're already on the waitlist — thanks for the enthusiasm.");
        return;
      }

      setStatus("error");
      setMessage(data?.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please check your connection and try again.");
    }
  }

  const isSuccess = status === "success" || status === "duplicate";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-4 rounded-3xl border border-sand bg-cream-soft p-6 shadow-2xl backdrop-blur-2xl sm:p-8"
      noValidate
    >
      <div>
        <label htmlFor="waitlist-email" className="mb-2 block text-sm font-bold text-ink">
          Email
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status === "submitting" || isSuccess}
          className="w-full rounded-2xl border border-sand bg-cream px-4 py-3.5 text-base text-ink outline-none transition placeholder:text-ink-soft focus:ring-2 focus:ring-jade focus:border-jade disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="waitlist-birthday" className="mb-2 block text-sm font-bold text-ink">
          Date of birth
        </label>
        <input
          id="waitlist-birthday"
          type="date"
          required
          max={todayIso}
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          disabled={status === "submitting" || isSuccess}
          className="w-full rounded-2xl border border-sand bg-cream px-4 py-3.5 text-base text-ink outline-none transition focus:ring-2 focus:ring-jade focus:border-jade disabled:opacity-60"
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={isAdult}
          onChange={(e) => setIsAdult(e.target.checked)}
          disabled={status === "submitting" || isSuccess}
          className="mt-1 h-4 w-4 shrink-0 rounded border-sand accent-jade"
        />
        <span className="text-ink-soft">I am 18 or older.</span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit || isSuccess}
        className="w-full rounded-2xl bg-jade hover:bg-jade-deep py-4 text-base font-extrabold text-white shadow-xl transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {status === "submitting" ? "Joining…" : isSuccess ? "Joined ✓" : "Join the waitlist"}
      </button>

      {message && (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`text-sm ${
            status === "error"
              ? "text-blush"
              : status === "duplicate"
                ? "text-ink-soft"
                : "text-jade"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
