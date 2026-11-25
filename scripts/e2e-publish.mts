/**
 * End-to-end publishing test against a running app, with REAL osu! data.
 *
 *   npm run dev            (in another terminal; needs OSU_CLIENT_ID/SECRET)
 *   npm run test:e2e -- [baseUrl] [osuUsername]
 *
 * Drives the studio in the local Edge/Chrome: search → design → publish →
 * BBCode / image / QR checks → public page → edit through the private link
 * in a fresh browser profile → update → refresh → invalid link → reset link.
 * Screenshots go to .renders/e2e/.
 */
import fs from "node:fs";
import jsQR from "jsqr";
import { chromium, type Page } from "playwright-core";
import sharp from "sharp";

const BASE = process.argv[2] ?? "http://localhost:3210";
const USER = process.argv[3] ?? "peppy";
const OUT = ".renders/e2e";
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

async function decodeQr(url: string): Promise<string | null> {
  const res = await fetch(url);
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch({ channel: "chrome" }));
const errors: string[] = [];
const watch = (p: Page) => {
  p.on("pageerror", (e) => errors.push(e.message));
};

try {
  // ------------------------------------------------------------ publish
  const owner = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await owner.newPage();
  watch(page);
  await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Publish card" }).waitFor();
  ok(await page.getByRole("button", { name: "Publish card" }).isDisabled(), "publish is disabled for fictional sample players");

  await page.fill("#player-search", USER);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByText(/Live · osu!|Cached · osu!/).waitFor({ timeout: 20000 });
  ok(true, `found real osu! player "${USER}"`);

  await page.getByRole("radiogroup", { name: "Template" }).getByRole("radio", { name: "Editorial" }).click();
  await page.getByRole("button", { name: "Crimson palette" }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Publish card" }).click();
  await page.getByRole("heading", { name: "Your card is live" }).waitFor({ timeout: 60000 });
  ok(true, "published: success dialog shown");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-published-dialog.png` });

  const dialog = page.locator("dialog[open]");
  const bbcode = await dialog.getByLabel("osu! BBCode").inputValue();
  const imageUrl = await dialog.getByLabel("Direct image URL (PNG)").inputValue();
  const pageUrl = await dialog.getByLabel("Public card page").inputValue();
  const editUrl = await dialog.getByLabel("Edit link").inputValue();
  const publicId = /\/card\/([0-9A-Za-z]{10})$/.exec(pageUrl)?.[1];
  ok(publicId, `public id ${publicId}`);
  ok(imageUrl === `${BASE}/c/${publicId}.png`, `image URL is ${imageUrl}`);
  const m = /^\[url=https:\/\/osu\.ppy\.sh\/users\/(\d+)\]\[img\](.+)\[\/img\]\[\/url\]$/.exec(bbcode);
  ok(m && m[2] === imageUrl, `BBCode format: ${bbcode}`);
  const osuId = Number(m?.[1]);
  ok(/^https?:\/\/.+\/edit\/[0-9A-Za-z]{10}#[A-Za-z0-9_-]{43}$/.test(editUrl), "edit URL carries the token in the fragment");
  ok(!bbcode.includes(editUrl.split("#")[1]) && !pageUrl.includes("#"), "token not present in public links");

  await dialog.getByRole("button", { name: "Copy" }).first().click();
  ok((await dialog.getByText("Copied").count()) > 0, "copy button confirms");
  ok((await page.evaluate(() => navigator.clipboard.readText())) === bbcode, "clipboard holds the BBCode");

  // ------------------------------------------------------------ image
  const img1 = await fetch(imageUrl);
  const etag1 = img1.headers.get("etag");
  const buf1 = Buffer.from(await img1.arrayBuffer());
  const meta = await sharp(buf1).metadata();
  ok(img1.status === 200 && img1.headers.get("content-type") === "image/png", "image URL returns image/png");
  ok(meta.width === 900 && meta.height === 300, `PNG is ${meta.width}×${meta.height}, ${(buf1.length / 1024).toFixed(0)} KB`);
  const cond = await fetch(imageUrl, { headers: { "if-none-match": etag1! } });
  ok(cond.status === 304, "conditional request returns 304");
  fs.writeFileSync(`${OUT}/published@1x.png`, buf1);

  // ------------------------------------------------------------ QR codes
  ok((await decodeQr(`${BASE}/api/qr?kind=card&id=${publicId}&format=png&download=1`)) === pageUrl, "card QR decodes to the public page URL");
  ok((await decodeQr(`${BASE}/api/qr?kind=profile&user=${osuId}&format=png&download=1`)) === `https://osu.ppy.sh/users/${osuId}`, "profile QR decodes to the osu! profile");
  const svgQr = await fetch(`${BASE}/api/qr?kind=card&id=${publicId}&format=svg&download=1`);
  ok(svgQr.headers.get("content-type") === "image/svg+xml" && /attachment/.test(svgQr.headers.get("content-disposition") ?? ""), "QR SVG download works");

  // ------------------------------------------------------------ public page
  const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pub = await visitor.newPage();
  watch(pub);
  await pub.goto(pageUrl, { waitUntil: "networkidle" });
  const shown = await pub.locator(`img[alt$="signature card"]`).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
  ok(shown, "public page shows the card image");
  ok((await pub.getByRole("link", { name: /Open osu! profile/ }).getAttribute("href")) === `https://osu.ppy.sh/users/${osuId}`, "public page links to the osu! profile");
  ok(!(await pub.content()).includes(editUrl.split("#")[1]), "public page HTML contains no edit token");
  await pub.screenshot({ path: `${OUT}/2-public-page.png`, fullPage: true });

  // ------------------------------------------------------------ edit via private link (fresh browser profile)
  const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ed = await other.newPage();
  watch(ed);
  await ed.goto(editUrl, { waitUntil: "networkidle" });
  await ed.waitForURL(/\/studio$/, { timeout: 30000 }).catch(async (e) => {
    await ed.screenshot({ path: `${OUT}/fail-edit-link.png` });
    throw e;
  });
  await ed.getByText("Published card is up to date").waitFor({ timeout: 20000 });
  ok(true, "edit link restores the published card in a fresh browser");
  const restoredTemplate = await ed.getByRole("radiogroup", { name: "Template" }).getByRole("radio", { checked: true }).innerText();
  ok(/Editorial/.test(restoredTemplate), "restored configuration (template Editorial)");

  await ed.getByRole("radiogroup", { name: "Template" }).getByRole("radio", { name: "Y2K" }).click();
  await ed.getByRole("button", { name: "Update published card" }).click();
  await ed.getByText("Published card is up to date").waitFor({ timeout: 60000 });
  const img2 = await fetch(imageUrl);
  ok(img2.status === 200 && img2.headers.get("etag") !== etag1, "update regenerated the PNG at the same URL (new ETag)");
  await ed.screenshot({ path: `${OUT}/3-editing.png` });

  await ed.getByRole("button", { name: /^Refresh/ }).click();
  await ed.getByRole("button", { name: /^Refresh/ }).waitFor();
  await ed.waitForTimeout(4000);
  ok((await ed.getByText(/Stats from (just now|\d+ min ago)/).count()) > 0, "manual stats refresh succeeded");

  // ------------------------------------------------------------ invalid + reset
  const bad = await (await browser.newContext()).newPage();
  await bad.goto(editUrl.replace(/#.+$/, "#" + "A".repeat(43)), { waitUntil: "networkidle" });
  await bad.getByText("This edit link doesn't work").waitFor({ timeout: 20000 });
  ok(true, "tampered edit link is rejected");

  await ed.getByRole("button", { name: "Share", exact: true }).click();
  await ed.getByRole("button", { name: "Reset edit link…" }).click();
  await ed.getByRole("button", { name: "Reset link" }).click();
  await ed.getByText("New link created").waitFor({ timeout: 20000 });
  const newEditUrl = await ed.locator("dialog[open]").getByLabel("Edit link").inputValue();
  ok(newEditUrl !== editUrl, "edit link reset issued a new link");
  const stale = await (await browser.newContext()).newPage();
  await stale.goto(editUrl, { waitUntil: "networkidle" });
  await stale.getByText("This edit link doesn't work").waitFor({ timeout: 20000 });
  ok(true, "old edit link stops working after reset");

  console.log(`\npublic page: ${pageUrl}\nimage:       ${imageUrl}`);
} catch (e) {
  failures++;
  console.error("✗ e2e aborted:", (e as Error).message);
} finally {
  await browser.close();
}
if (errors.length) console.log("page errors:\n" + errors.join("\n"));
console.log(failures ? `\n✗ ${failures} check(s) failed` : "\n✓ end-to-end publishing flow passed");
process.exit(failures ? 1 : 0);
