// Headless screenshot harness for design QA.
// Usage: node design-review/shoot.mjs <before|after>
// Captures landing + /generate at desktop (1440) and mobile (375), light + dark.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PHASE = process.argv[2] || "before";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = `design-review/${PHASE}`;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

// Force English + skip any splash by setting locale cookie if the app uses one.
async function prep(page) {
  // Reduce motion so animated equalizers/confetti don't blur shots.
  await page.emulateMedia({ reducedMotion: "reduce" });
}

// Pre-seed cookie consent so the real banner doesn't obscure the design, and
// hide the Next.js dev-mode badge (dev-only chrome, absent in production).
const CONSENT = JSON.stringify({
  version: "V1.0",
  choice: "accepted",
  categories: { necessary: true, preferences: true, analytics: true, marketing: true },
});
async function seed(ctx) {
  await ctx.addInitScript((consent) => {
    try { window.localStorage.setItem("smb_cookie_consent", consent); } catch {}
  }, CONSENT);
}

async function shoot(page, path, file, { dark = false, full = true } = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await prep(page);
  if (dark) {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }
  // Hide dev-only chrome (Next badge) so shots reflect production.
  await page.addStyleTag({
    content: "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}",
  }).catch(() => {});
  // Let fonts + layout settle.
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    locale: "en-US",
  });
  await seed(ctx);
  const page = await ctx.newPage();

  await shoot(page, "/", `landing-${vp.name}-light`);
  await shoot(page, "/", `landing-${vp.name}-dark`, { dark: true });
  await shoot(page, "/generate", `generate-${vp.name}-light`);
  await shoot(page, "/generate", `generate-${vp.name}-dark`, { dark: true });

  await ctx.close();
  console.log(`✓ ${vp.name} shots done`);
}
await browser.close();
console.log(`All ${PHASE} screenshots in ${OUT}/`);
