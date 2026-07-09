"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/next";
// Type-only import — `lib/consent` pulls in `node:crypto`, which must not be
// bundled into the client. Types are erased at compile time, so this is safe.
import type {
  CookieCategory,
  CookieConsentPayload,
  ConsentChoice,
} from "@/lib/consent";

// Versions are duplicated here as the *client* source. The server route
// (`/api/consent`) is authoritative: it defaults `policy_version` to
// `LEGAL_VERSION` from `lib/legal`. Keep these in sync with `lib/legal.ts`
// (LEGAL_VERSION / COOKIE_BANNER_VERSION).
const POLICY_VERSION = "V1.0";
const BANNER_VERSION = "V1.0";

const CONSENT_COOKIE = "smb_cookie_consent";
const CONSENT_STORAGE_KEY = "smb_cookie_consent";
const ANON_ID_KEY = "smb_anon_id";
const CONSENT_MAX_AGE_DAYS = 365;
const CONSENT_CHANGED_EVENT = "smb:consent-changed";

const BANNER_COPY =
  "We use cookies and similar technologies to operate Sing My Birthday, remember your preferences, secure checkout, measure usage, improve the product, and, with your consent, personalise marketing and offers. You can accept all, reject non-essential cookies, or manage your choices by category.";

type CategoryMeta = {
  key: CookieCategory;
  label: string;
  description: string;
  locked?: boolean;
};

const CATEGORY_META: ReadonlyArray<CategoryMeta> = [
  {
    key: "necessary",
    label: "Necessary",
    description:
      "Required to operate the site and secure checkout. Always on — these cannot be disabled.",
    locked: true,
  },
  {
    key: "preferences",
    label: "Preferences",
    description: "Language, region, and display/pricing choices.",
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Usage, funnel, playback, downloads, and performance.",
  },
  {
    key: "marketing",
    label: "Marketing",
    description:
      "Meta/TikTok/Google pixels, remarketing, and campaign attribution.",
  },
];

type Categories = Record<CookieCategory, boolean>;

const ALL_ON: Categories = {
  necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
};

const ESSENTIAL_ONLY: Categories = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

type StoredConsent = {
  version: string;
  choice: ConsentChoice;
  categories: Categories;
};

// ── External store (localStorage / first-party cookie) ────────────────────
// Consent lives outside React, so we read it via useSyncExternalStore. This
// keeps SSR and the first client render consistent (server snapshot = null →
// nothing analytics-related renders until the client confirms a decision).

function readRawCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(CONSENT_COOKIE.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readSnapshot(): string | null {
  try {
    const fromLs = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (fromLs) return fromLs;
  } catch {
    // localStorage unavailable — fall back to the cookie.
  }
  try {
    return readRawCookie();
  } catch {
    return null;
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const getServerSnapshot = (): string | null => null;

function parseConsent(raw: string | null): StoredConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    // No record, or a stale banner/policy version — treat as "undecided" so the
    // banner re-prompts on a version bump.
    if (!parsed || parsed.version !== BANNER_VERSION || !parsed.categories) {
      return null;
    }
    return {
      version: BANNER_VERSION,
      choice: parsed.choice ?? "custom",
      categories: {
        necessary: true,
        preferences: parsed.categories.preferences === true,
        analytics: parsed.categories.analytics === true,
        marketing: parsed.categories.marketing === true,
      },
    };
  } catch {
    return null;
  }
}

function persistLocal(record: StoredConsent): void {
  const serialized = JSON.stringify(record);
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, serialized);
  } catch {
    // localStorage blocked (private mode) — the cookie below is the fallback.
  }
  try {
    const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serialized)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Ignore — best effort.
  }
  // Same-document writes don't fire the native `storage` event, so notify the
  // store subscribers ourselves.
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

function getOrCreateAnonId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id = `anon_${crypto.randomUUID()}`;
    window.localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    // No storage — generate an ephemeral id for this event.
    return `anon_${crypto.randomUUID()}`;
  }
}

export default function CookieConsent() {
  const raw = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);
  const consent = useMemo(() => parseConsent(raw), [raw]);

  const [showPreferences, setShowPreferences] = useState(false);
  const [draft, setDraft] = useState<Categories>(ESSENTIAL_ONLY);

  // Footer "Cookie Preferences" button reopens the center from anywhere.
  useEffect(() => {
    function openPrefs() {
      setDraft(consent?.categories ?? ESSENTIAL_ONLY);
      setShowPreferences(true);
    }
    window.addEventListener("smb:open-cookie-preferences", openPrefs);
    return () =>
      window.removeEventListener("smb:open-cookie-preferences", openPrefs);
  }, [consent]);

  const logConsent = useCallback(
    (choice: ConsentChoice, categories: Categories) => {
      const payload: CookieConsentPayload = {
        choice,
        categories,
        anonymousId: getOrCreateAnonId(),
        userId: null,
        interfaceVersion: BANNER_VERSION,
        policyVersion: POLICY_VERSION,
      };
      // Best-effort: a failed consent-log POST must never block the UI or the
      // user's choice. keepalive lets it survive a navigation.
      try {
        void fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Ignore network/serialization errors.
      }
    },
    [],
  );

  const apply = useCallback(
    (choice: ConsentChoice, categories: Categories) => {
      persistLocal({ version: BANNER_VERSION, choice, categories });
      setShowPreferences(false);
      logConsent(choice, categories);
    },
    [logConsent],
  );

  const acceptAll = useCallback(() => apply("accept_all", ALL_ON), [apply]);
  const rejectNonEssential = useCallback(
    () => apply("reject_non_essential", ESSENTIAL_ONLY),
    [apply],
  );
  const savePreferences = useCallback(
    () => apply("custom", { ...draft, necessary: true }),
    [apply, draft],
  );

  const analyticsAllowed = consent?.categories.analytics === true;
  // const marketingAllowed = consent?.categories.marketing === true;
  // ↑ When marketing pixels (Meta/TikTok/Google) are added, mount them here
  //   guarded by `marketingAllowed` so they never load before consent.

  // Show the first-visit banner only when no valid decision is stored.
  const showBanner = consent === null && !showPreferences;

  return (
    <>
      {/* Analytics loads ONLY after the user has consented to the Analytics
          category. Before consent (or on reject) it is never mounted. */}
      {analyticsAllowed && <Analytics />}

      {showBanner && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4"
        >
          <div className="mx-auto max-w-3xl rounded-2xl border border-sand bg-cream-soft/95 p-5 text-ink shadow-[0_24px_60px_-30px_rgba(60,40,30,0.5)] backdrop-blur-xl sm:p-6">
            <p className="text-sm leading-relaxed text-ink-soft">{BANNER_COPY}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  // The banner only shows when no decision is stored, so the
                  // draft starts from essential-only.
                  setDraft(ESSENTIAL_ONLY);
                  setShowPreferences(true);
                }}
                className="order-3 rounded-xl border border-sand bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream sm:order-1"
              >
                Manage preferences
              </button>
              <button
                type="button"
                onClick={rejectNonEssential}
                className="order-2 rounded-xl border border-sand bg-cream px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-jade"
              >
                Reject non-essential
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="order-1 rounded-xl bg-jade px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-jade-deep sm:order-3"
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreferences && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
          className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/50 p-4 sm:items-center"
        >
          <div className="w-full max-w-lg rounded-2xl border border-sand bg-cream-soft p-6 text-ink shadow-[0_40px_90px_-30px_rgba(60,40,30,0.6)]">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-lg font-extrabold text-ink">Cookie preferences</h2>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                aria-label="Close cookie preferences"
                className="rounded-lg px-2 py-1 text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {BANNER_COPY}
            </p>

            <div className="mt-5 space-y-3">
              {CATEGORY_META.map((cat) => {
                const checked = cat.locked ? true : draft[cat.key];
                return (
                  <label
                    key={cat.key}
                    className="flex items-start gap-3 rounded-xl border border-sand bg-cream p-4"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={cat.locked}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [cat.key]: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 shrink-0 rounded accent-jade disabled:opacity-60"
                    />
                    <span>
                      <span className="block text-sm font-bold">
                        {cat.label}
                        {cat.locked && (
                          <span className="ml-2 text-xs font-medium text-ink-soft">
                            Always on
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {cat.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={rejectNonEssential}
                className="rounded-xl border border-sand bg-cream px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-jade"
              >
                Reject non-essential
              </button>
              <button
                type="button"
                onClick={savePreferences}
                className="rounded-xl bg-jade px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-jade-deep"
              >
                Save preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
