// Quiet-hours guard for the AI character call — TCPA calling-hours compliance.
//
// The TCPA restricts calls to 8am–9pm in the CALLED party's local time. We don't
// collect the recipient's timezone explicitly, so we derive a *representative*
// IANA zone from their phone's E.164 country calling code. This is best-effort:
// large countries span several zones (a US +1 number could be Eastern or
// Pacific), so we pick one representative zone per country. It's a secondary
// safety net — the giver already chooses the call date — not the primary control.
//
// When the zone is unknown we allow the call rather than wedge it forever
// (returning true), and log upstream. Pure + server-safe; the caller passes the
// clock in (`nowIso`) so this stays deterministic and testable.

/** Earliest / latest local hour a call may be placed (inclusive start, exclusive end). */
export const CALL_WINDOW_START_HOUR = 8;
export const CALL_WINDOW_END_HOUR = 21; // 9pm

// E.164 country calling code → a representative IANA timezone. Longest-prefix
// match wins (3-digit codes before 1-digit). Not exhaustive — covers our launch
// markets + common codes; unmapped codes fall through to "unknown".
const CODE_TO_TZ: Array<[string, string]> = [
  // 3-digit
  ["971", "Asia/Dubai"], ["966", "Asia/Riyadh"], ["852", "Asia/Hong_Kong"],
  ["420", "Europe/Prague"], ["358", "Europe/Helsinki"], ["353", "Europe/Dublin"],
  ["351", "Europe/Lisbon"], ["234", "Africa/Lagos"],
  // 2-digit
  ["44", "Europe/London"], ["33", "Europe/Paris"], ["49", "Europe/Berlin"],
  ["34", "Europe/Madrid"], ["39", "Europe/Rome"], ["31", "Europe/Amsterdam"],
  ["46", "Europe/Stockholm"], ["47", "Europe/Oslo"], ["45", "Europe/Copenhagen"],
  ["41", "Europe/Zurich"], ["43", "Europe/Vienna"], ["30", "Europe/Athens"],
  ["48", "Europe/Warsaw"], ["40", "Europe/Bucharest"], ["36", "Europe/Budapest"],
  ["90", "Europe/Istanbul"], ["20", "Africa/Cairo"], ["27", "Africa/Johannesburg"],
  ["81", "Asia/Tokyo"], ["82", "Asia/Seoul"], ["86", "Asia/Shanghai"],
  ["91", "Asia/Kolkata"], ["65", "Asia/Singapore"], ["63", "Asia/Manila"],
  ["62", "Asia/Jakarta"], ["60", "Asia/Kuala_Lumpur"], ["66", "Asia/Bangkok"],
  ["84", "Asia/Ho_Chi_Minh"], ["61", "Australia/Sydney"], ["64", "Pacific/Auckland"],
  ["55", "America/Sao_Paulo"], ["52", "America/Mexico_City"], ["54", "America/Argentina/Buenos_Aires"],
  ["56", "America/Santiago"], ["57", "America/Bogota"], ["51", "America/Lima"],
  // 1-digit
  ["1", "America/New_York"], ["7", "Europe/Moscow"],
];

/**
 * A representative IANA timezone for an E.164 phone number, or null when the
 * calling code isn't mapped. Best-effort — see the file header.
 */
export function timezoneForPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  for (const [code, tz] of CODE_TO_TZ) {
    if (digits.startsWith(code)) return tz;
  }
  return null;
}

/**
 * The current local hour (0–23) in a timezone at `nowIso`, or null if the zone
 * is invalid / unavailable. Uses Intl so it tracks DST automatically.
 */
export function localHourInTimezone(tz: string, nowIso: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(nowIso));
    const raw = parts.find((p) => p.type === "hour")?.value;
    if (raw == null) return null;
    let hour = Number.parseInt(raw, 10);
    if (hour === 24) hour = 0; // some runtimes render midnight as "24"
    return Number.isFinite(hour) ? hour : null;
  } catch {
    return null;
  }
}

/**
 * May a call be placed right now for a booking? True when the recipient's local
 * time is inside the 8am–9pm window. When the timezone is unknown OR can't be
 * resolved, returns true (allow) rather than wedging the booking — the guard is
 * a safety net, not the primary consent control.
 */
export function isWithinCallingWindow(nowIso: string, tz: string | null): boolean {
  if (!tz) return true;
  const hour = localHourInTimezone(tz, nowIso);
  if (hour == null) return true;
  return hour >= CALL_WINDOW_START_HOUR && hour < CALL_WINDOW_END_HOUR;
}
