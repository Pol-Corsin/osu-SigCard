/**
 * Verifies the generated text-measurement tables against resvg's real
 * rendering, for every card font. If a font is swapped or misnamed, or the
 * tables go stale, widths diverge and this fails.
 *
 * Run: npm run test:metrics
 */
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { CARD_FONTS } from "../src/modules/render/fonts";
import { measureText } from "../src/modules/render/measure";
import japanese from "../src/modules/templates/editorial/japanese.json";

const files = CARD_FONTS.map((f) => path.join(process.cwd(), "public", f.file));
const SAMPLES = ["WWWWWWWWWWWWWWW", "kairo_", "[Saffron Tide]", "#4,812", "98.42%", "Ostrander_Hale", "lllllIIII1111"];
const JP = [...Object.values(japanese.modes), ...Object.values(japanese.stats)];

let worst = 0;
let failed = 0;
for (const f of CARD_FONTS) {
  const strings = f.family === "Shippori Mincho" || f.family === "Zen Kaku Gothic New" ? [...SAMPLES, ...JP] : SAMPLES;
  for (const s of strings) {
    const size = 100;
    // Two copies of the text with different trailing glyphs cancel side-bearing effects:
    // advance width = x of a marker glyph placed right after the string.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200"><text x="10" y="150" font-family="${f.family}" font-weight="${f.weight}" font-style="${f.style}" font-size="${size}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}<tspan fill="red">|</tspan></text></svg>`;
    const svgRef = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200"><text x="10" y="150" font-family="${f.family}" font-weight="${f.weight}" font-style="${f.style}" font-size="${size}">|</text></svg>`;
    const opts = { font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: "Hanken Grotesk" } };
    const bb = new Resvg(svg, opts).getBBox();
    const ref = new Resvg(svgRef, opts).getBBox();
    if (!bb || !ref) throw new Error(`no bbox for ${f.family}`);
    const actual = bb.x + bb.width - (ref.x + ref.width); // width of s
    const predicted = measureText(s, { family: f.family, weight: f.weight, style: f.style, size });
    const err = Math.abs(actual - predicted) / Math.max(actual, 1);
    worst = Math.max(worst, err);
    if (err > 0.02) {
      failed++;
      console.error(`✗ ${f.family} ${f.weight}${f.style === "italic" ? "i" : ""} "${s}": predicted ${predicted.toFixed(1)}, resvg ${actual.toFixed(1)} (${(err * 100).toFixed(1)}%)`);
    }
  }
}
console.log(`${failed ? "✗" : "✓"} text metrics vs resvg: worst error ${(worst * 100).toFixed(2)}% across ${CARD_FONTS.length} fonts`);
process.exit(failed ? 1 : 0);
