// Route-driven screenshot harness for the site-wide rollout QA.
// Usage: node design-review/shoot-routes.mjs <before|after> '[{"path":"/","name":"landing"},...]'
// Captures each route at desktop (1440) + mobile (375), light + dark.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PHASE = process.argv[2] || "before";
const ROUTES = JSON.parse(process.argv[3] || "[]");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = `design-review/${PHASE}`;
mkdirSync(OUT, { recursive: true });

const CONSENT = JSON.stringify({
  version: "V1.0", choice: "accepted",
  categories: { necessary: true, preferences: true, analytics: true, marketing: true },
});
const HIDE = "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2, locale: "en-US",
    });
    await ctx.addInitScript((c) => { try { localStorage.setItem("smb_cookie_consent", c); } catch {} }, CONSENT);
    if (theme === "dark") {
      await ctx.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch {} });
    }
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const r of ROUTES) {
      try {
        await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 20000 });
        await page.addStyleTag({ content: HIDE }).catch(() => {});
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/${r.name}-${vp.name}-${theme}.png`, fullPage: true });
      } catch (e) {
        console.log(`✗ ${r.name} ${vp.name} ${theme}: ${e.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
  console.log(`✓ ${vp.name} done`);
}
await browser.close();
console.log(`All ${PHASE} route screenshots in ${OUT}/`);
