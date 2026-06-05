// One-off: convert assets/{logo,favicon}.jpeg → transparent PNGs in public/brand/
// + favicon variants in public/. Run with: node /tmp/build_brand_assets.mjs
//
// White-background removal: threshold any pixel whose R/G/B are all ≥ 240
// to fully transparent. The logos are vibrant pinks/purples/oranges against
// pure white, so this clean-threshold approach is safe.

import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

const ROOT = "/Users/lotirium/Desktop/song generator/birthday-song-demo";
const SRC_MARK = `${ROOT}/assets/favicon.jpeg`;
const SRC_LOCKUP = `${ROOT}/assets/logo.jpeg`;
const BRAND_DIR = `${ROOT}/public/brand`;
const PUB = `${ROOT}/public`;

const WHITE_THRESHOLD = 240;

async function transparentPng(src, outPath, opts = {}) {
  const img = sharp(src).ensureAlpha();
  const { width, height } = await img.metadata();
  const { data, info } = await img
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      out[i + 3] = 0;
    }
  }

  let pipeline = sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  if (opts.resize) {
    pipeline = pipeline.resize(opts.resize, opts.resize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`  ✓ ${outPath} (${width}×${height} src)`);
}

async function trimmedFaviconPng(src, outPath, size) {
  // Square favicon: trim white border then resize. Keeps the mark centered and large.
  const buf = await sharp(src)
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 10 })
    .toBuffer();
  await sharp(buf)
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}×${size})`);
}

await mkdir(BRAND_DIR, { recursive: true });

console.log("=== Transparent brand assets ===");
await transparentPng(SRC_MARK, `${BRAND_DIR}/logo-mark.png`, { resize: 512 });
await transparentPng(SRC_LOCKUP, `${BRAND_DIR}/logo-lockup.png`);

// White silhouette of the mark — for the email-header gradient, where the
// colored variant camouflages against the same pink/purple/amber palette.
console.log("\n=== White-silhouette mark (for gradient backgrounds) ===");
{
  const src = `${BRAND_DIR}/logo-mark.png`;
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] > 0) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
    }
  }
  const target = `${BRAND_DIR}/logo-mark-white.png`;
  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(target);
  console.log(`  ✓ ${target} (${info.width}×${info.height})`);
}

// Social-share preview card (Open Graph / Twitter / WhatsApp / iMessage).
// 1200×630 is the universal OG canvas. Mark sits at ~33% of canvas width
// (400px) so it reads at thumbnail size on mobile previews.
//
// Trim the transparent padding off the source mark first — otherwise the
// SVG <image> at width=400 renders the artwork at only ~50% of that width
// (the rest being invisible padding) and the mark reads as small as ~15%
// of the canvas.
console.log("\n=== Open-Graph share card ===");
{
  const trimmedMark = await sharp(`${BRAND_DIR}/logo-mark.png`)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
    .png()
    .toBuffer();
  const markB64 = trimmedMark.toString("base64");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.42"/>
      <stop offset="45%" stop-color="#ec4899" stop-opacity="0.20"/>
      <stop offset="82%" stop-color="#070019" stop-opacity="0"/>
    </radialGradient>
    <filter id="drop" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#000" flood-opacity="0.50"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#070019"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <image x="400" y="60" width="400" height="400" preserveAspectRatio="xMidYMid meet" filter="url(#drop)" href="data:image/png;base64,${markB64}"/>
  <text x="600" y="525" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="72" font-weight="800" fill="#ffffff" letter-spacing="1">Sing My Birthday</text>
  <text x="600" y="580" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="26" font-weight="500" fill="rgba(255,255,255,0.78)">Personalized birthday songs in any language</text>
</svg>`;
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(`${PUB}/og-image.png`);
  console.log(`  ✓ ${PUB}/og-image.png (1200×630)`);
}

console.log("\n=== Favicon variants ===");
await trimmedFaviconPng(SRC_MARK, `${PUB}/apple-touch-icon.png`, 180);
await trimmedFaviconPng(SRC_MARK, `${PUB}/icon-192.png`, 192);
await trimmedFaviconPng(SRC_MARK, `${PUB}/icon-512.png`, 512);
// favicon.ico: PNG with .ico extension. All modern browsers + Next.js accept this.
await trimmedFaviconPng(SRC_MARK, `${PUB}/favicon.ico`, 32);

console.log("\nDone.");
