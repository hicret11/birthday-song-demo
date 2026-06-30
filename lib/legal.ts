import { readFile } from "node:fs/promises";
import path from "node:path";

export const LEGAL_VERSION = "V1.0";
export const LEGAL_EFFECTIVE_DATE = "Friday, May 29, 2026";
export const LEGAL_ENTITY = "GLOBAL MOBILITY TECHNOLOGIES LLC";
export const COOKIE_BANNER_VERSION = "V1.0";
export const PROMO_PERMISSION_TEXT_VERSION = "V1.0";

// Where/which version of the purchase-time legal acceptance the user saw. Used
// as evidence metadata on Stripe checkout and in the legal_acceptance log.
export const LEGAL_ACCEPTANCE_SURFACE = "checkout";
export const LEGAL_ACCEPTANCE_VERSION = "V1.0";

export type LegalDocSlug = "terms" | "privacy" | "cookies";

export const LEGAL_DOCS: Record<
  LegalDocSlug,
  { title: string; filename: string; description: string }
> = {
  terms: {
    title: "Terms of Service",
    filename: "terms-v1.0.txt",
    description:
      "Master legal terms governing access to and use of Sing My Birthday.",
  },
  privacy: {
    title: "Privacy Policy",
    filename: "privacy-v1.0.txt",
    description:
      "How Sing My Birthday collects, uses, stores, shares, and protects personal data.",
  },
  cookies: {
    title: "Cookie Policy",
    filename: "cookies-v1.0.txt",
    description:
      "How Sing My Birthday uses cookies, local storage, pixels, tags, and similar technologies.",
  },
};

export async function loadLegalText(slug: LegalDocSlug): Promise<string> {
  const doc = LEGAL_DOCS[slug];
  const filePath = path.join(process.cwd(), "content", "legal", doc.filename);
  return readFile(filePath, "utf8");
}
