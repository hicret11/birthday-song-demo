// Procedurally generate the cake + candle overlay PNGs that lib/video.ts
// composites onto the share-page video. SVG sources are kept inline here
// so the in-form CakeIcon component and the rendered video stay visually
// consistent — same shapes, just rasterized at output resolution.
//
// Outputs:
//   public/brand/cakes/{chocolate,vanilla,rainbow,custom}.png   (400×400)
//   public/brand/candles/{pink,purple,blue,cyan,green,yellow,orange,red}.png
//                                                              (300×120)
//
// Run with: `npm run build:cake-assets` (idempotent — re-running overwrites).

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_CAKE = path.join(ROOT, "public", "brand", "cakes");
const OUT_CANDLE = path.join(ROOT, "public", "brand", "candles");

// SVG shapes mirror the CakeIcon component in GeneratorClient.tsx. The
// preview chip in the form uses a 40×40 viewBox; here we scale to 400×400
// and add the same color treatment so a user picking "chocolate" in the
// form sees the same chocolate cake in the rendered video.
const CAKE_SVGS = {
  // Body lightened from #6b3a23 (deep brown, too close to the Classic
  // template's natural cake silhouette) to a warm sienna so the overlay
  // reads against every template. Frosting strip + dollops bumped up
  // proportionally; a 2px #D7A05F rim catches "light" along the top edge.
  chocolate: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="200" cy="345" rx="180" ry="18" fill="#000000" opacity="0.25" />
    <rect x="60" y="220" width="280" height="120" rx="14" fill="#A0522D" />
    <rect x="60" y="220" width="280" height="22" fill="#B8743D" />
    <ellipse cx="100" cy="242" rx="14" ry="8" fill="#B8743D" />
    <ellipse cx="170" cy="242" rx="14" ry="8" fill="#B8743D" />
    <ellipse cx="240" cy="242" rx="14" ry="8" fill="#B8743D" />
    <ellipse cx="310" cy="242" rx="14" ry="8" fill="#B8743D" />
    <rect x="60" y="220" width="280" height="2" fill="#D7A05F" />
  </svg>`,

  vanilla: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="200" cy="345" rx="180" ry="18" fill="#000000" opacity="0.25" />
    <rect x="60" y="220" width="280" height="120" rx="14" fill="#fff7e0" />
    <rect x="60" y="220" width="280" height="22" fill="#ffe4a3" />
    <ellipse cx="100" cy="242" rx="14" ry="8" fill="#ffe4a3" />
    <ellipse cx="170" cy="242" rx="14" ry="8" fill="#ffe4a3" />
    <ellipse cx="240" cy="242" rx="14" ry="8" fill="#ffe4a3" />
    <ellipse cx="310" cy="242" rx="14" ry="8" fill="#ffe4a3" />
    <rect x="120" y="250" width="3" height="10" rx="1" fill="#ec4899" transform="rotate(20 121.5 255)" />
    <rect x="200" y="250" width="3" height="10" rx="1" fill="#a855f7" transform="rotate(-15 201.5 255)" />
    <rect x="280" y="250" width="3" height="10" rx="1" fill="#3b82f6" transform="rotate(10 281.5 255)" />
    <rect x="150" y="265" width="3" height="10" rx="1" fill="#facc15" transform="rotate(-25 151.5 270)" />
    <rect x="250" y="270" width="3" height="10" rx="1" fill="#22c55e" transform="rotate(15 251.5 275)" />
  </svg>`,

  rainbow: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="cakeClip">
        <rect x="60" y="220" width="280" height="120" rx="14" />
      </clipPath>
    </defs>
    <ellipse cx="200" cy="345" rx="180" ry="18" fill="#000000" opacity="0.25" />
    <g clip-path="url(#cakeClip)">
      <rect x="60" y="220" width="280" height="30" fill="#ec4899" />
      <rect x="60" y="250" width="280" height="30" fill="#a855f7" />
      <rect x="60" y="280" width="280" height="30" fill="#3b82f6" />
      <rect x="60" y="310" width="280" height="30" fill="#facc15" />
    </g>
    <rect x="60" y="220" width="280" height="3" fill="#ffffff" opacity="0.4" />
  </svg>`,

  custom: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="200" cy="345" rx="180" ry="18" fill="#000000" opacity="0.25" />
    <rect x="60" y="220" width="280" height="120" rx="14" fill="#a855f7" />
    <rect x="60" y="220" width="280" height="22" fill="#c084fc" />
    <text x="200" y="312" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">?</text>
    <rect x="60" y="220" width="280" height="3" fill="#ffffff" opacity="0.3" />
  </svg>`,
};

// Brand-aligned hex values. Order mirrors CANDLE_COLORS in lib/api-types.ts
// so adding a new color in one place + re-running this script is the full
// change needed for a new pick.
const CANDLE_HEX = {
  pink: "#ec4899",
  purple: "#a855f7",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#facc15",
  orange: "#f59e0b",
  red: "#ef4444",
};

function candleSvg(hex) {
  return `<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="40" width="36" height="75" rx="4" fill="${hex}" />
    <rect x="132" y="40" width="36" height="75" rx="4" fill="${hex}" />
    <rect x="214" y="40" width="36" height="75" rx="4" fill="${hex}" />
    <rect x="50" y="55" width="36" height="3" fill="#ffffff" opacity="0.35" />
    <rect x="132" y="55" width="36" height="3" fill="#ffffff" opacity="0.35" />
    <rect x="214" y="55" width="36" height="3" fill="#ffffff" opacity="0.35" />
    <rect x="67" y="32" width="2" height="8" fill="#333333" />
    <rect x="149" y="32" width="2" height="8" fill="#333333" />
    <rect x="231" y="32" width="2" height="8" fill="#333333" />
    <ellipse cx="68" cy="22" rx="7" ry="11" fill="#fb923c" />
    <ellipse cx="150" cy="22" rx="7" ry="11" fill="#fb923c" />
    <ellipse cx="232" cy="22" rx="7" ry="11" fill="#fb923c" />
    <ellipse cx="68" cy="24" rx="3" ry="7" fill="#facc15" />
    <ellipse cx="150" cy="24" rx="3" ry="7" fill="#facc15" />
    <ellipse cx="232" cy="24" rx="3" ry="7" fill="#facc15" />
  </svg>`;
}

async function writePng(svg, outPath, width, height) {
  await mkdir(path.dirname(outPath), { recursive: true });
  // density=288 renders SVG at ~4× before sharp downscales — clean
  // anti-aliasing on the curved/rounded shapes without blowing up file
  // size after PNG compression.
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath);
  console.log(`  wrote ${path.relative(ROOT, outPath)}`);
}

console.log("Generating cake PNGs (400×400)…");
for (const [style, svg] of Object.entries(CAKE_SVGS)) {
  await writePng(svg, path.join(OUT_CAKE, `${style}.png`), 400, 400);
}

console.log("Generating candle PNGs (300×120)…");
for (const [color, hex] of Object.entries(CANDLE_HEX)) {
  await writePng(candleSvg(hex), path.join(OUT_CANDLE, `${color}.png`), 300, 120);
}

console.log("done.");
