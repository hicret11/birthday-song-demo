// Full-funnel review harness. Captures the entire journey at desktop (1440) +
// mobile (375), light + dark. Static routes are shot full-page; the premiere
// reveal is additionally captured in its OPENED (curtain-raised) state by
// clicking the start-premiere CTA.
// Usage: BASE_URL=... node design-review/shoot-funnel.mjs <out> '<routesJSON>'
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT_NAME = process.argv[2] || "review";
const ROUTES = JSON.parse(process.argv[3] || "[]");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = `design-review/${OUT_NAME}`;
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
        await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 25000 });
        if (theme === "dark") {
          await page.evaluate(() => document.documentElement.classList.add("dark"));
        }
        await page.addStyleTag({ content: HIDE }).catch(() => {});
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/${r.name}-${vp.name}-${theme}.png`, fullPage: !r.viewport });
        // Reveal interaction: click the start-premiere CTA and capture opened state.
        if (r.openReveal) {
          const cta = page.getByRole("button", { name: /premiere|start|open|раскр/i }).first();
          if (await cta.count()) {
            await cta.click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(1600);
            await page.screenshot({ path: `${OUT}/${r.name}-open-${vp.name}-${theme}.png`, fullPage: false });
          }
        }
      } catch (e) {
        console.log(`✗ ${r.name} ${vp.name} ${theme}: ${e.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
  console.log(`✓ ${vp.name} done`);
}
await browser.close();
console.log(`All ${OUT_NAME} screenshots in ${OUT}/`);
