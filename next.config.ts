import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Baseline security headers applied to every response. Conservative on purpose:
// no strict CSP (would need per-page allowlisting of Stripe/Sentry/analytics and
// risks breaking checkout), but the low-risk hardening headers every production
// site should send. HSTS is safe because Vercel always serves over HTTPS.
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    // Only microphone is used (voice name capture on /generate); everything else off.
    value: "camera=(), geolocation=(), microphone=(self), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
  ],
  outputFileTracingIncludes: {
    "/api/share": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./public/video-fonts/**/*",
      "./public/video-templates/**/*",
    ],
    "/api/share/[id]/regenerate": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./public/video-fonts/**/*",
      "./public/video-templates/**/*",
    ],
    "/api/slideshow/render": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./public/video-fonts/**/*",
    ],
    "/api/share/[id]/preview": [
      "./node_modules/@ffmpeg-installer/**/*",
    ],
    "/api/transcribe-name": [
      "./node_modules/@ffmpeg-installer/**/*",
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Quiet the wrapper's own build-time logging.
  silent: true,
  // Don't fail the build if source-map upload to Sentry can't authenticate
  // (e.g. SENTRY_AUTH_TOKEN unset). Source maps are nice-to-have, not blocker.
  errorHandler: () => {},
});
