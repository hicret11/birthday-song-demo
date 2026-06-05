import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces and machine endpoints. /v/*/manage is per-venue
        // self-service, surfaced only via direct link from the venue itself.
        disallow: ["/api/", "/onboarding", "/v/*/manage"],
      },
    ],
    sitemap: "https://singmybirthday.com/sitemap.xml",
    host: "https://singmybirthday.com",
  };
}
