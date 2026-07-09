// Country allowlist for the AI birthday CALL (and only the call).
//
// The rest of the product is fully global — this gate applies solely to placing
// the automated AI phone call (the $44.99 "Full Production" add-on and the
// à-la-carte cast call). At launch we only place calls to recipients in:
//   US (+1), United Kingdom (+44), Türkiye (+90), United Arab Emirates (+971).
//
// Unlike the quiet-hours guard (which ALLOWS on unknown so it never wedges a
// booking), this gate FAILS CLOSED: an unmapped / unrecognized number is NOT
// offered the call. A country allowlist that defaulted to "allow" wouldn't be a
// gate.
//
// CAVEAT (documented on purpose): +1 is the North American Numbering Plan, shared
// by the US with Canada and Caribbean territories. Distinguishing US-only within
// +1 needs area-code tables; at launch we treat all +1 as allowed and label it
// "US". If US-strict is required later, add an area-code check here.

/** ISO 3166-1 alpha-2 countries whose recipients may receive the AI call. */
export const ALLOWED_CALL_COUNTRIES = ["US", "GB", "TR", "AE"] as const;
export type AllowedCallCountry = (typeof ALLOWED_CALL_COUNTRIES)[number];

// E.164 calling-code prefix → ISO country, longest prefix first. Only the
// allowlisted countries appear here; everything else resolves to null (denied).
const ALLOWED_CODE_TO_COUNTRY: Array<[string, AllowedCallCountry]> = [
  ["971", "AE"],
  ["90", "TR"],
  ["44", "GB"],
  ["1", "US"],
];

/**
 * The allowlisted country for an E.164 phone number, or null when the number
 * isn't in an allowed country (or can't be parsed). Fails closed.
 */
export function callCountryForPhone(
  phone: string | null | undefined,
): AllowedCallCountry | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  for (const [code, country] of ALLOWED_CODE_TO_COUNTRY) {
    if (digits.startsWith(code)) return country;
  }
  return null;
}

/** Whether the AI call may be offered/placed to this recipient number. */
export function isCallAllowedForPhone(phone: string | null | undefined): boolean {
  return callCountryForPhone(phone) !== null;
}
