import { randomUUID } from "node:crypto";
import { LEGAL_VERSION } from "./legal";

export const COOKIE_CATEGORIES = [
  "necessary",
  "preferences",
  "analytics",
  "marketing",
] as const;

export type CookieCategory = (typeof COOKIE_CATEGORIES)[number];
export type ConsentChoice = "accept_all" | "reject_non_essential" | "custom";

export type CookieConsentPayload = {
  choice: ConsentChoice;
  categories: Record<CookieCategory, boolean>;
  anonymousId?: string;
  userId?: string | null;
  countryRegion?: string | null;
  interfaceVersion: string;
  policyVersion?: string;
};

export function normalizeCookieCategories(
  value: Partial<Record<CookieCategory, unknown>> | undefined,
): Record<CookieCategory, boolean> {
  return {
    necessary: true,
    preferences: value?.preferences === true,
    analytics: value?.analytics === true,
    marketing: value?.marketing === true,
  };
}

export function newAnonymousId(): string {
  return `anon_${randomUUID()}`;
}

export function normalizePolicyVersion(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 20) : LEGAL_VERSION;
}
