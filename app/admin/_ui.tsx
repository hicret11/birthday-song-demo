// Shared server-rendered UI primitives for the admin dashboard. No "use client"
// — pure markup (Tailwind). Utilitarian SaaS/dashboard style.
import type { ReactNode } from "react";

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-100">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-neutral-500">{hint}</div>}
    </div>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "purple" | "fuchsia";
const TONE: Record<Tone, string> = {
  neutral: "border-neutral-700 bg-neutral-800 text-neutral-300",
  green: "border-green-800 bg-green-950 text-green-300",
  amber: "border-amber-800 bg-amber-950 text-amber-300",
  red: "border-red-800 bg-red-950 text-red-300",
  blue: "border-blue-800 bg-blue-950 text-blue-300",
  purple: "border-purple-800 bg-purple-950 text-purple-300",
  fuchsia: "border-fuchsia-800 bg-fuchsia-950 text-fuchsia-300",
};
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${TONE[tone]}`}>{children}</span>;
}

const EVENT_TONE: Record<string, Tone> = {
  generation_started: "blue",
  music_submitted: "purple",
  song_ready: "green",
  share_created: "fuchsia",
  download_requested: "amber",
  playback_started: "neutral",
  share_click: "neutral",
  share_page_view: "neutral",
};
export function EventBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-neutral-600">—</span>;
  return <Badge tone={EVENT_TONE[type] ?? "neutral"}>{type}</Badge>;
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      {title && <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>}
      {children}
    </div>
  );
}

export const inputCls = "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100";
export const btnCls = "rounded bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-500";
export const tableCls = "w-full border-collapse text-xs";
export const theadCls = "border-b border-neutral-700 text-left text-neutral-400";
export const trCls = "border-b border-neutral-900 hover:bg-neutral-900/60";

/** Mask an email for table display: hi•••@gmail.com. Full value when reveal=true. */
export function maskEmail(email: string | null, reveal = false): string {
  if (!email) return "—";
  if (reveal) return email;
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}${"•".repeat(3)}@${domain}`;
}

type CalloutTone = "neutral" | "amber" | "green" | "red" | "blue";
const CALLOUT: Record<CalloutTone, string> = {
  neutral: "border-neutral-800 bg-neutral-900/50 text-neutral-300",
  amber: "border-amber-800/70 bg-amber-950/40 text-amber-200",
  green: "border-green-800/70 bg-green-950/40 text-green-200",
  red: "border-red-800/70 bg-red-950/40 text-red-200",
  blue: "border-blue-800/70 bg-blue-950/40 text-blue-200",
};
export function Callout({
  tone = "neutral", title, children,
}: { tone?: CalloutTone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${CALLOUT[tone]}`}>
      {title && <div className="mb-1.5 font-semibold">{title}</div>}
      <div className="space-y-1.5 leading-relaxed opacity-95">{children}</div>
    </div>
  );
}

/** Small link-style button for opening external resources. */
export const linkBtnCls =
  "inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800/60 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800";

export function fmtTs(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

/** ISO cutoff `hoursAgo` before now (server time). */
export function cutoffIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}
