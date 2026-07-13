"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/**
 * Records first-touch traffic attribution once, on first load. No UI. Mounted
 * site-wide so the *original* entry point (utm/referrer/`?src=`) is remembered
 * before the visitor navigates deeper. The value only leaves the browser via the
 * consent-gated analytics `track()` calls, never on its own.
 */
export default function Attribution() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
