/**
 * Tiles rendered cards from .renders/ into one PNG for visual review.
 * Run: npx tsx scripts/contact-sheet.ts <substring-filter> [out.png] [columns]
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const [filter = "", outName = "contact-sheet.png", colsArg = "2"] = process.argv.slice(2);
const dir = path.join(process.cwd(), ".renders");
const files = fs.readdirSync(dir).filter((f) => f.endsWith("@1x.png") && f.includes(filter)).sort();
const cols = Number(colsArg);
const cellW = 900, cellH = 330, pad = 16;
const rows = Math.ceil(files.length / cols);
const W = cols * (cellW + pad) + pad, H = rows * (cellH + pad) + pad;

let body = "";
files.forEach((f, i) => {
  const x = pad + (i % cols) * (cellW + pad);
  const y = pad + Math.floor(i / cols) * (cellH + pad);
  const b64 = fs.readFileSync(path.join(dir, f)).toString("base64");
  const isCompact = f.includes("-compact-");
  const w = isCompact ? 640 : 900, h = isCompact ? 200 : 300;
  body += `<image href="data:image/png;base64,${b64}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  body += `<text x="${x}" y="${y + h + 20}" font-family="Hanken Grotesk" font-size="15" fill="#9c95af">${f}</text>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#100f16"/>${body}</svg>`;
const png = new Resvg(svg, { font: { fontFiles: [path.join(process.cwd(), "public/fonts/card/hanken-grotesk-400.ttf")], loadSystemFonts: false } }).render().asPng();
fs.writeFileSync(path.join(dir, outName), png);
console.log(`${files.length} cards → .renders/${outName}`);
