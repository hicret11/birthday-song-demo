// Comp (free-unlock) email allowlist.
//
// A short list of trusted addresses — the team's admins — whose song unlocks are
// comped: they can generate and unlock the full deliverable (audio + video)
// without paying, so we can dogfood the real buyer flow end-to-end. The gate is
// ownership-proven: the checkout route only trusts the email from the verified
// magic-link session (lib/user-session), never a client-supplied value, so a
// stranger can't claim an admin's address without receiving that inbox's link.
//
// Two sources, merged: a built-in default (so it works with no env config) and
// an optional COMP_EMAILS env var (comma/space/semicolon-separated) for adding
// more addresses without a code change. All comparisons are lowercase-normalized.

/** Built-in admin addresses. Lowercased at read time, so casing here is cosmetic. */
const DEFAULT_COMP_EMAILS: readonly string[] = [
  "lemonigrootkerk@gmail.com",
  "nilyufarmobeius@gmail.com",
  "hicretharman47@gmail.com",
];

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** Parse COMP_EMAILS (comma/space/semicolon/newline separated) into normalized entries. */
function envCompEmails(): string[] {
  const raw = process.env.COMP_EMAILS;
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map(normalize)
    .filter(Boolean);
}

/** The full comp allowlist (defaults ∪ env), normalized and de-duped. */
export function compEmailSet(): Set<string> {
  return new Set<string>([...DEFAULT_COMP_EMAILS.map(normalize), ...envCompEmails()]);
}

/**
 * True when `email` is a comped (free-unlock) admin address. `null`/blank →
 * false, so an un-logged-in visitor is never treated as comped.
 */
export function isCompEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return compEmailSet().has(normalize(email));
}
