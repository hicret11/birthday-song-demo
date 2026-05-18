import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
  ],
  outputFileTracingIncludes: {
    "/api/share": [
      "./node_modules/@ffmpeg-installer/**/*",
    ],
  },
};

export default nextConfig;
