// Sentry init for the browser. NEXT_PUBLIC_SENTRY_DSN is the public DSN —
// safe to expose to client bundles. Without it set, the SDK no-ops cleanly.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // Replay only the moments leading up to errors — cheap on volume.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
});
