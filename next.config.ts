import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
  ],
  outputFileTracingIncludes: {
    "/api/share": [
      "./public/video-templates/**/*",
      "./public/video-fonts/**/*",
      "./node_modules/@ffmpeg-installer/**/*",
    ],
  },
};

export default nextConfig;
