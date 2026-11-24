/**
 * Generates static assets shared by the browser preview and the server renderer:
 *  1. public/flags/XX.svg        – country flags (country-flag-icons, MIT)
 *  2. src/modules/render/font-metrics.generated.json
 *                                – advance widths + kerning for every card font,
 *                                  so text fitting is identical on both sides.
 *
 * Run with: npm run build:assets
 */
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import * as flags from "country-flag-icons/string/3x2";
import { CARD_FONTS, fontKey } from "../src/modules/render/fonts";
import japanese from "../src/modules/templates/editorial/japanese.json";

const root = process.cwd();

// ---------- flags ----------
const flagDir = path.join(root, "public", "flags");
fs.mkdirSync(flagDir, { recursive: true });
let flagCount = 0;
for (const [code, svg] of Object.entries(flags as Record<string, string>)) {
  if (typeof svg !== "string" || !/^[A-Z]{2}$/.test(code)) continue;
  fs.writeFileSync(path.join(flagDir, `${code}.svg`), svg);
  flagCount++;
}
console.log(`flags: wrote ${flagCount} files`);

// ---------- font metrics ----------
const CHARS: string[] = [];
for (let c = 32; c <= 126; c++) CHARS.push(String.fromCharCode(c));
CHARS.push("…", "·", "—", "–", "%", "#", "№", "×", "°");
const jpText = Object.values(japanese.modes).join("") + Object.values(japanese.stats).join("") + japanese.misc.join("");
for (const ch of new Set(Array.from(jpText))) CHARS.push(ch);

type Metrics = {
  unitsPerEm: number;
  fallback: number;
  advances: Record<string, number>;
  kerning: Record<string, number>;
};

const out: Record<string, Metrics> = {};
for (const f of CARD_FONTS) {
  const buf = fs.readFileSync(path.join(root, "public", f.file));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // resvg (fontdb) matches the typographic family (name ID 16) when present, else ID 1.
  // If this doesn't equal the declared family, the server silently falls back to
  // another font and PNGs stop matching the browser preview — fail loudly instead.
  type NameTable = Record<string, { en?: string } | undefined>;
  const all = font.names as unknown as Record<string, NameTable | undefined>;
  const names = all.windows ?? all.unicode ?? all.macintosh;
  const internal = names?.preferredFamily?.en ?? names?.fontFamily?.en;
  if (internal !== f.family) {
    throw new Error(`${f.file}: internal family "${internal}" ≠ declared "${f.family}". Use a build with correct name tables.`);
  }
  const weightClass = font.tables.os2?.usWeightClass;
  if (Math.abs(weightClass - f.weight) > 50) {
    throw new Error(`${f.file}: weight class ${weightClass} ≠ declared ${f.weight}.`);
  }
  const italic = (font.tables.os2.fsSelection & 1) === 1;
  if (italic !== (f.style === "italic")) {
    throw new Error(`${f.file}: italic flag is ${italic}, declared style "${f.style}".`);
  }
  const advances: Record<string, number> = {};
  const glyphs: Record<string, opentype.Glyph> = {};
  for (const ch of CHARS) {
    const g = font.charToGlyph(ch);
    if (!g || g.index === 0) continue;
    glyphs[ch] = g;
    advances[ch] = g.advanceWidth ?? 0;
  }
  const kerning: Record<string, number> = {};
  const keys = Object.keys(glyphs);
  for (const a of keys)
    for (const b of keys) {
      const k = font.getKerningValue(glyphs[a], glyphs[b]);
      if (k) kerning[a + b] = k;
    }
  const fallback = advances["n"] ?? font.unitsPerEm * 0.55;
  out[fontKey(f.family, f.weight, f.style)] = { unitsPerEm: font.unitsPerEm, fallback, advances, kerning };
  console.log(`metrics: ${f.family} ${f.weight}${f.style === "italic" ? " italic" : ""} – ${keys.length} glyphs, ${Object.keys(kerning).length} kern pairs`);
}
fs.writeFileSync(
  path.join(root, "src", "modules", "render", "font-metrics.generated.json"),
  JSON.stringify(out),
);
