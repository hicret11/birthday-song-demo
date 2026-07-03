import { ImageResponse } from "next/og";
import { loadSharedSong } from "@/lib/share";

// Dynamic, per-name social-share card. Next App Router auto-detects this
// file-convention image and uses it for both Open Graph and Twitter
// (because the share page sets twitter.card = "summary_large_image").
// No external fonts are loaded — we rely on the renderer's default font so
// this can never fail at runtime on a font fetch.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Happy Birthday — Sing My Birthday";

export default async function Image({
  params,
}: {
  params: { id: string };
}) {
  const song = await loadSharedSong(params.id).catch(() => null);
  const name = (song?.name ?? "").trim();
  const headline = name ? `🎂 Happy Birthday, ${name}!` : "🎂 Happy Birthday!";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #070019 0%, #12062f 55%, #1e1646 100%)",
          color: "#ffffff",
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#f5d0fe",
          }}
        >
          <span style={{ marginRight: 14, fontSize: 34 }}>🎵</span>
          Sing My Birthday
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              display: "flex",
              maxWidth: 1000,
              backgroundImage:
                "linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #f59e0b 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 34,
              fontWeight: 500,
              color: "#cbd5e1",
              display: "flex",
            }}
          >
            A personalized birthday song, made just for you.
          </div>
        </div>

        {/* Brand-gradient accent bar */}
        <div
          style={{
            display: "flex",
            height: 14,
            width: "100%",
            borderRadius: 999,
            backgroundImage:
              "linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #f59e0b 100%)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
