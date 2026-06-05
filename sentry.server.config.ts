// Sentry init for the Node.js runtime (route handlers, server components,
// API routes). Loaded by instrumentation.ts. Without SENTRY_DSN set, the SDK
// no-ops cleanly.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
  // Don't ship Sentry's own dev console noise.
  debug: false,
});
