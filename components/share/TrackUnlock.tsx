"use client";

import { useEffect, useRef } from "react";
import { track } from "@vercel/analytics";

/**
 * Fires the `song_unlocked` conversion event once, on the post-checkout landing.
 *
 * Rendered by the share page only when the buyer has just been redirected back
 * from Stripe (`?unlocked=1` + a `session_id`), so it counts a real purchase —
 * not a refresh of an already-unlocked page, and not a comped admin unlock
 * (those carry no session_id). Together with `paywall_viewed` and `unlock_click`
 * (both tagged with tier + launch_percent) this closes the funnel so conversion
 * and revenue can be sliced by price/tier and by launch-discount on vs off.
 */
export default function TrackUnlock({
  plan,
  tier,
  launchPercent,
}: {
  plan: string;
  tier: string;
  launchPercent: number;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    try {
      track("song_unlocked", { plan, tier, launch_percent: launchPercent });
    } catch {
      // Analytics is non-critical; swallow.
    }
  }, [plan, tier, launchPercent]);
  return null;
}
