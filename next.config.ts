import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
  ],
  outputFileTracingIncludes: {
    "/api/share": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./public/video-fonts/**/*",
    ],
    "/api/share/[id]/regenerate": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./public/video-fonts/**/*",
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
