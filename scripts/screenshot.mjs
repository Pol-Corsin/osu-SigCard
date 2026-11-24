// Dev QA helper: screenshots the studio (every template) with the local Edge/Chrome.
// Usage: node scripts/screenshot.mjs [baseUrl] [outDir]
import { chromium } from "playwright-core";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3210";
const out = process.argv[3] ?? ".renders";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch({ channel: "chrome" }));
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
await page.waitForSelector('[aria-label="Card settings"]', { timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[aria-label="Card settings"]');

for (const name of ["Player Card", "Minimal", "Editorial", "Artistic", "Cyberpunk", "Y2K"]) {
  await page.getByRole("radiogroup", { name: "Template" }).getByRole("radio", { name }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/ui-${name.toLowerCase().replace(/\s+/g, "-")}.png` });
}
// Design section close-up (template grid + variants)
await page.getByRole("radiogroup", { name: "Template" }).scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/ui-design-section.png`, clip: { x: 0, y: 56, width: 312, height: 844 } });

const mobile = await browser.newPage({ viewport: { width: 400, height: 860 } });
await mobile.goto(`${base}/studio`, { waitUntil: "networkidle" });
await mobile.waitForSelector('[aria-label="Card settings"]');
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: `${out}/ui-mobile.png` });

await browser.close();
console.log(errors.length ? errors.join("\n") : "no console errors");
