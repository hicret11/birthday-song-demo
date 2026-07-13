// First-touch traffic attribution (client-only).
//
// Answers "where did this visitor come from?" and keeps that answer for the
// whole session so it can be attached to conversion events — so we can see which
// channels actually produce buyers, not just visits. Vercel Web Analytics
// already shows raw referrers/countries/pages; this adds the *source tied to the
// funnel* (paywall_viewed / unlock_click / song_unlocked carry it).
//
// Privacy: stores only a coarse source label + referrer host in sessionStorage
// (first-party, cleared when the tab closes) — no cookies, no cross-site ids, no
// PII. The values are only ever transmitted via the consent-gated `track()`
// pipeline, so a visitor who declines analytics is never reported.

const STORAGE_KEY = "smb_attribution_v1";

export type Attribution = {
  /** Coarse channel: a utm_source, our own `?src=` tag, a referrer host, or "direct". */
  source: string;
  /** Raw referrer hostname (or "" for direct / same-site). */
  referrer: string;
};

/** Hosts that are "us" — treat as internal navigation, not a traffic source. */
function isSelfHost(host: string): boolean {
  return /(^|\.)singmybirthday\.com$/i.test(host) || host === "localhost";
}

/** Map a referrer hostname to a friendly channel label. */
function labelForReferrerHost(host: string): string {
  const h = host.toLowerCase();
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(h)) return "whatsapp";
  if (/(^|\.)(t\.me|telegram\.org|telegram\.me)$/.test(h)) return "telegram";
  if (/(^|\.)(google\.)/.test(h)) return "google";
  if (/(^|\.)(instagram\.com)$/.test(h)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com|lm\.facebook\.com)$/.test(h)) return "facebook";
  if (/(^|\.)(tiktok\.com)$/.test(h)) return "tiktok";
  if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(h)) return "twitter";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return "youtube";
  if (/(^|\.)(reddit\.com)$/.test(h)) return "reddit";
  if (/(^|\.)(bing\.com)$/.test(h)) return "bing";
  return h; // unknown referrer — keep the bare host so it's still attributable
}

/** Resolve this landing's source from URL params + document.referrer. */
function resolveSource(): Attribution {
  let referrerHost = "";
  try {
    if (document.referrer) referrerHost = new URL(document.referrer).hostname;
  } catch {
    // malformed referrer — ignore
  }

  const params = new URLSearchParams(window.location.search);
  // Priority: explicit campaign tag > our own share/link tag > referrer > direct.
  const utm = params.get("utm_source")?.trim();
  const src = params.get("src")?.trim() || params.get("ref")?.trim();

  let source: string;
  if (utm) source = utm.toLowerCase().slice(0, 40);
  else if (src) source = src.toLowerCase().slice(0, 40);
  else if (referrerHost && !isSelfHost(referrerHost)) source = labelForReferrerHost(referrerHost);
  else source = "direct";

  return { source, referrer: isSelfHost(referrerHost) ? "" : referrerHost.slice(0, 80) };
}

/**
 * Capture first-touch attribution once per session. Safe to call on every page
 * load — it only writes the first time, so the *original* entry point is what's
 * remembered even after the visitor clicks around the site.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return; // first-touch already set
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(resolveSource()));
  } catch {
    // storage unavailable (private mode / blocked) — attribution just no-ops
  }
}

/** Read the session's first-touch attribution (or a safe default). */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return { source: "unknown", referrer: "" };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Attribution>;
      if (parsed && typeof parsed.source === "string") {
        return { source: parsed.source, referrer: typeof parsed.referrer === "string" ? parsed.referrer : "" };
      }
    }
    // Not captured yet (e.g. landing straight on this page) — resolve live.
    return resolveSource();
  } catch {
    return { source: "unknown", referrer: "" };
  }
}
