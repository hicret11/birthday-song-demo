"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

type Props = {
  venue_slug: string | null;
};

export default function TrackShareView({ venue_slug }: Props) {
  useEffect(() => {
    const has_referrer =
      typeof document !== "undefined" && document.referrer !== "";
    track("share_page_view", {
      has_referrer,
      venue_slug: venue_slug ?? "none",
    });
  }, [venue_slug]);
  return null;
}
