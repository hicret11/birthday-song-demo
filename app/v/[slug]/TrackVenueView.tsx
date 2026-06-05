"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

type Props = {
  slug: string;
  venue_name: string;
};

export default function TrackVenueView({ slug, venue_name }: Props) {
  useEffect(() => {
    track("venue_page_view", { slug, venue_name });
  }, [slug, venue_name]);
  return null;
}
