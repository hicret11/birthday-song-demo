// Sentry init for the Edge runtime. The current app routes all run on
// nodejs runtime, but this config exists so middleware or any future edge
// route is covered automatically.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
  debug: false,
});
