"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { logClientEvent } from "@/lib/client-events";

type Props = {
  venue_slug: string | null;
  share_id: string;
  recipient_name: string;
  language: string;
  genre: string;
};

export default function TrackShareView({
  venue_slug,
  share_id,
  recipient_name,
  language,
  genre,
}: Props) {
  useEffect(() => {
    const has_referrer =
      typeof document !== "undefined" && document.referrer !== "";
    // Vercel Analytics (third-party; gated by the Phase 1 cookie consent).
    track("share_page_view", {
      has_referrer,
      venue_slug: venue_slug ?? "none",
    });
    // Durable first-party audit event — always logged, independent of consent.
    logClientEvent("share_page_view", {
      share_id,
      venue_slug,
      recipient_name,
      language,
      genre,
      metadata: { has_referrer },
    });
  }, [venue_slug, share_id, recipient_name, language, genre]);
  return null;
}
