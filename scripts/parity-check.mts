/**
 * Browser ↔ server parity check.
 *
 * Renders the identical SVG (same template code, same embedded images, same
 * font files) in a real browser (local Edge/Chrome via playwright-core) and in
 * resvg, then pixel-diffs the two. Anti-aliasing and blur implementations
 * differ slightly between engines, so we report the share of clearly
 * different pixels per template and fail above a threshold.
 *
 * Run: npm run test:parity [-- <templateId> ...]   (writes diff images of failures to .renders/parity/;
 *      set PARITY_DUMP=1 to write them for every case)
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { DEFAULT_CONFIG, type CardConfig } from "../src/modules/cards/config";
import { sampleSnapshot } from "../src/modules/player/fixtures";
import { resolveAssetsForRender } from "../src/modules/render/assets";
import { cardFontFaceCss } from "../src/modules/render/fonts";
import { rasterize, renderCardSvg } from "../src/modules/render/render";
import { ALL_TEMPLATE_IDS, TEMPLATES } from "../src/modules/templates/registry";

const THRESHOLD = 0.03; // max share of differing pixels per card
const outDir = path.join(process.cwd(), ".renders", "parity");
fs.mkdirSync(outDir, { recursive: true });

// Tiny static server for /fonts so the browser loads the exact TTFs resvg uses.
const pub = path.join(process.cwd(), "public");
const server = http.createServer((req, res) => {
  const file = path.normalize(path.join(pub, decodeURIComponent((req.url ?? "/").split("?")[0])));
  if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html>");
  res.writeHead(200, { "content-type": file.endsWith(".ttf") ? "font/ttf" : "application/octet-stream" }).end(fs.readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch({ channel: "chrome" }));
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/fonts/card/`).catch(() => undefined);

// All four modes, plus the edge cases templates must design for: no cover
// art, a long name with a six-digit rank, and no avatar or cover at all.
type ParityCase = { player: number; mode: CardConfig["player"]["mode"]; tag?: string; noAvatar?: boolean; noCover?: boolean };
const cases: ParityCase[] = [
  { player: 90000001, mode: "osu" },
  { player: 90000003, mode: "fruits" },
  { player: 90000002, mode: "mania" },
  { player: 90000004, mode: "osu", tag: "nocover-longname" },
  { player: 90000005, mode: "taiko", tag: "noassets", noAvatar: true, noCover: true },
];

let failed = 0;
const rows: string[] = [];
const only = process.argv.slice(2);
for (const id of ALL_TEMPLATE_IDS) {
  if (only.length && !only.includes(id)) continue;
  const t = TEMPLATES[id];
  for (const size of t.sizes)
    for (const variant of t.variants.length ? t.variants.map((v) => v.id) : [null])
      for (const c of cases) {
        const player = sampleSnapshot(c.player, c.mode);
        const config: CardConfig = { ...DEFAULT_CONFIG, template: id, size, variant, player: { id: c.player, mode: c.mode } };
        const resolved = await resolveAssetsForRender(player);
        const assets = { ...resolved, avatar: c.noAvatar ? null : resolved.avatar, cover: c.noCover ? null : resolved.cover };
        const svg = await renderCardSvg(player, config, assets);
        const server = PNG.sync.read(rasterize(svg, 1));

        await page.setViewportSize({ width: server.width, height: server.height });
        await page.setContent(
          `<!doctype html><html><head><base href="http://localhost:${port}/"><style>${cardFontFaceCss()} html,body{margin:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`,
        );
        await page.evaluate(async () => {
          const fams = Array.from(document.querySelectorAll("text")).map((el) => {
            const cs = getComputedStyle(el);
            return `${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`;
          });
          await Promise.all([...new Set(fams)].map((f) => document.fonts.load(f)));
          await document.fonts.ready;
        });
        const browserPng = PNG.sync.read(await page.locator("svg").screenshot({ omitBackground: false }));

        const diff = new PNG({ width: server.width, height: server.height });
        const bad = pixelmatch(server.data, browserPng.data, diff.data, server.width, server.height, { threshold: 0.2, includeAA: false });
        const share = bad / (server.width * server.height);
        const name = `${id}-${size}${variant ? "-" + variant : ""}-${c.player}-${c.mode}${c.tag ? "-" + c.tag : ""}`;
        if (share > THRESHOLD) failed++;
        if (share > THRESHOLD || process.env.PARITY_DUMP === "1") {
          fs.writeFileSync(path.join(outDir, `${name}-browser.png`), PNG.sync.write(browserPng));
          fs.writeFileSync(path.join(outDir, `${name}-server.png`), PNG.sync.write(server));
          fs.writeFileSync(path.join(outDir, `${name}-diff.png`), PNG.sync.write(diff));
        }
        rows.push(`${share > THRESHOLD ? "✗" : "✓"} ${name.padEnd(66)} ${(share * 100).toFixed(2)}% pixels differ`);
      }
}
await browser.close();
server.close();
console.log(rows.join("\n"));
console.log(`\n${failed ? "✗" : "✓"} browser vs server parity: ${rows.length - failed}/${rows.length} within ${(THRESHOLD * 100).toFixed(0)}%`);
process.exit(failed ? 1 : 0);
