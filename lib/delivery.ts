// Birthday countdown delivery — the giver-sends model.
//
// We do NOT collect the recipient's contact or send anything to them. Instead we
// compute the UTC instant of "9am local on the recipient's next birthday" from
// the captured month-day + the giver's timezone, store it on the song, and the
// share page shows a locked premiere-ticket countdown until that instant passes
// (the giver can preview early via a signed token). This is a pure client-side
// GATE on top of the paywall — never a scheduled send, never a media leak.
//
// Timezones are stored as IANA names (never offsets) so DST/law changes resolve
// correctly at read time. The clock (`nowMs`) is always passed in so this stays
// pure + testable.

export type DeliveryMode = "now" | "scheduled";

export type Delivery = {
  /** UTC ISO instant the premiere unlocks. Absent for mode "now". */
  deliverAt?: string;
  /** IANA timezone the birthday hour was resolved in. */
  timezone?: string;
  mode: DeliveryMode;
};

/** Local hour the premiere is released on the birthday. */
export const RELEASE_HOUR_LOCAL = 9;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse "MM-DD" → {month, day}, or null when malformed. */
function parseMonthDay(monthDay: string): { month: number; day: number } | null {
  const m = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

/**
 * The offset (localWallClock − UTC, in ms) of a timezone at a given UTC instant.
 * Computed by formatting the instant in the zone and diffing — the standard,
 * dependency-free way to get a historical/future-correct offset.
 */
function tzOffsetMs(timezone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asUtc - utcMs;
}

/** UTC ms for a wall-clock time in a timezone (offset-correction, DST-safe). */
function zonedWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  timezone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  // Correct twice so a guess that lands on the "wrong" side of a DST boundary
  // still resolves to the right instant.
  const o1 = tzOffsetMs(timezone, guess);
  const o2 = tzOffsetMs(timezone, guess - o1);
  return guess - o2;
}

/**
 * UTC ISO instant of 9am local on the NEXT occurrence of the birthday month-day
 * in `timezone`, relative to `nowMs`. "Next" = this year's date if still future,
 * else next year. Leap-day (02-29) falls back to 02-28 in non-leap years.
 * Returns null when the month-day or timezone is invalid.
 */
export function computeDeliverAt(
  monthDay: string,
  timezone: string,
  nowMs: number,
): string | null {
  const md = parseMonthDay(monthDay);
  if (!md || !isValidTimezone(timezone)) return null;
  const nowYear = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric" }).format(
      new Date(nowMs),
    ),
  );
  if (!Number.isFinite(nowYear)) return null;
  for (let year = nowYear; year <= nowYear + 1; year++) {
    const day = md.month === 2 && md.day === 29 && !isLeap(year) ? 28 : md.day;
    const ms = zonedWallTimeToUtcMs(year, md.month, day, RELEASE_HOUR_LOCAL, timezone);
    if (ms > nowMs) return new Date(ms).toISOString();
  }
  return null;
}

/**
 * Has the premiere been released at `nowMs`? True for "now" mode, an absent/
 * invalid deliverAt, or a deliverAt already in the past — i.e. "show the reveal".
 * False only while a scheduled premiere is still in the future (show countdown).
 */
export function isDelivered(delivery: Delivery | undefined, nowMs: number): boolean {
  if (!delivery || delivery.mode !== "scheduled" || !delivery.deliverAt) return true;
  const t = Date.parse(delivery.deliverAt);
  return Number.isNaN(t) || nowMs >= t;
}

/** `isDelivered` evaluated at the current instant (keeps the clock read out of
 *  the caller's render path). */
export function isDeliveredNow(delivery: Delivery | undefined): boolean {
  return isDelivered(delivery, Date.now());
}

/** IANA timezone sanity check for untrusted input. */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
