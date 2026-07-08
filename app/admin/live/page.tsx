import { requireAdmin } from "@/lib/admin-auth";
import { listLiveBookings, type CastBooking, type CastStatus } from "@/lib/cast";
import { getLiveCities, isLiveCastEnabled, liveKindLabel } from "@/lib/cast/live";
import { Badge, Callout, Panel, btnCls, inputCls, fmtTs } from "../_ui";
import { setLiveStatusAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Statuses the concierge can set by hand (mirrors actions.ts).
const MANUAL_STATUSES: CastStatus[] = ["contacted", "confirmed", "completed", "canceled"];

// Newest-relevant first: things needing action, then in-progress, then done.
const STATUS_ORDER: Record<string, number> = {
  scheduled: 0,
  contacted: 1,
  confirmed: 2,
  pending: 3,
  completed: 4,
  canceled: 5,
};

function statusTone(s: string): "green" | "amber" | "red" | "neutral" | "purple" {
  if (s === "completed") return "green";
  if (s === "scheduled") return "amber";
  if (s === "contacted" || s === "confirmed") return "purple";
  if (s === "canceled" || s === "failed") return "red";
  return "neutral";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <span className="min-w-0 break-words text-neutral-200">{children || "—"}</span>
    </div>
  );
}

function BookingCard({ b }: { b: CastBooking }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-neutral-100">
          {b.recipientName}{" "}
          <span className="text-xs font-normal text-neutral-500">· {liveKindLabel(b.kind)}</span>
        </div>
        <Badge tone={statusTone(b.status)}>{b.status}</Badge>
      </div>

      <div className="grid gap-1.5 text-xs sm:grid-cols-2">
        <Field label="city">{b.city}</Field>
        <Field label="event date">{b.eventDate}</Field>
        <Field label="phone">{b.contactPhone}</Field>
        <Field label="email">{b.contactEmail}</Field>
        <Field label="address">{b.addressNote}</Field>
        <Field label="note">{b.personalNote}</Field>
        <Field label="paid">{b.stripePaymentId ? "yes" : "no"}</Field>
        <Field label="created">{fmtTs(b.createdAt)}</Field>
      </div>

      <form action={setLiveStatusAction.bind(null, b.id)} className="mt-3 flex items-center gap-2">
        <select name="status" defaultValue="contacted" className={inputCls}>
          {MANUAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className={btnCls}>
          Update status
        </button>
        <span className="font-mono text-[10px] text-neutral-600">{b.id.slice(0, 8)}</span>
      </form>
    </div>
  );
}

export default async function LiveCastPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { ok, err } = await searchParams;

  const bookings = await listLiveBookings();
  const sorted = [...bookings].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  const counts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});
  const cities = getLiveCities();

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Live Cast — concierge</h1>

      {ok && <Callout tone="green">Updated.</Callout>}
      {err && <Callout tone="red" title="Error">{err}</Callout>}

      <Panel title="Pilot">
        {isLiveCastEnabled() ? (
          <p className="text-neutral-300">
            Live cast is <span className="font-semibold text-green-400">ON</span> in{" "}
            <span className="font-semibold">{cities.join(", ")}</span>. These are human-fulfilled —
            contact each booker, confirm details, then mark the booking as you go.
          </p>
        ) : (
          <p className="text-neutral-400">
            Live cast is <span className="font-semibold text-amber-400">OFF</span> — set{" "}
            <span className="font-mono">CAST_LIVE_CITIES</span> to enable the entry point. Existing
            bookings below are still shown.
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          {Object.entries(counts)
            .map(([s, n]) => `${s}: ${n}`)
            .join("  ·  ") || "no bookings yet"}
        </p>
      </Panel>

      {sorted.length === 0 ? (
        <Callout tone="neutral">No live bookings yet.</Callout>
      ) : (
        <div className="mt-4 grid gap-3">
          {sorted.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
