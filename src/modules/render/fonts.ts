/**
 * Card font registry — the single source of truth for typography on cards.
 *
 * The same TTF files are used by:
 *  - the browser preview (via @font-face rules generated from this list), and
 *  - the server rasterizer (resvg loads these exact files, system fonts disabled).
 * Family names here must match the fonts' internal family names, because
 * resvg matches by internal name while the browser matches by @font-face name.
 * Files are produced by scripts/fonts/build_fonts.py (static instances, subset).
 */
export type CardFontFamily =
  | "Hanken Grotesk"
  | "Saira Condensed"
  | "Chakra Petch"
  | "JetBrains Mono"
  | "Shippori Mincho"
  | "Zen Kaku Gothic New"
  | "Michroma"
  | "Space Mono"
  | "Fraunces"
  | "Archivo Expanded"
  | "Unbounded"
  | "Instrument Serif"
  | "Caveat";

export type FontStyle = "normal" | "italic";

export type CardFont = {
  family: CardFontFamily;
  weight: number;
  style: FontStyle;
  /** Path relative to /public */
  file: string;
};

const f = (family: CardFontFamily, weight: number, file: string, style: FontStyle = "normal"): CardFont => ({
  family,
  weight,
  style,
  file: `fonts/card/${file}`,
});

export const CARD_FONTS: CardFont[] = [
  f("Hanken Grotesk", 200, "hanken-grotesk-200.ttf"),
  f("Hanken Grotesk", 300, "hanken-grotesk-300.ttf"),
  f("Hanken Grotesk", 400, "hanken-grotesk-400.ttf"),
  f("Hanken Grotesk", 500, "hanken-grotesk-500.ttf"),
  f("Hanken Grotesk", 600, "hanken-grotesk-600.ttf"),
  f("Saira Condensed", 500, "saira-condensed-500.ttf"),
  f("Saira Condensed", 600, "saira-condensed-600.ttf"),
  f("Saira Condensed", 700, "saira-condensed-700.ttf"),
  f("Saira Condensed", 800, "saira-condensed-800.ttf"),
  f("Chakra Petch", 600, "chakra-petch-600.ttf"),
  f("Chakra Petch", 700, "chakra-petch-700.ttf"),
  f("JetBrains Mono", 400, "jetbrains-mono-400.ttf"),
  f("JetBrains Mono", 700, "jetbrains-mono-700.ttf"),
  f("Shippori Mincho", 700, "shippori-mincho-700.ttf"),
  f("Shippori Mincho", 800, "shippori-mincho-800.ttf"),
  f("Zen Kaku Gothic New", 400, "zen-kaku-gothic-new-400.ttf"),
  f("Zen Kaku Gothic New", 700, "zen-kaku-gothic-new-700.ttf"),
  f("Michroma", 400, "michroma-400.ttf"),
  f("Space Mono", 400, "space-mono-400.ttf"),
  f("Space Mono", 700, "space-mono-700.ttf"),
  f("Fraunces", 300, "fraunces-300-italic.ttf", "italic"),
  f("Fraunces", 800, "fraunces-800-italic.ttf", "italic"),
  // v2 templates (scripts/fonts/build_fonts.py v2)
  f("Archivo Expanded", 800, "archivo-expanded-800.ttf"),
  f("Archivo Expanded", 900, "archivo-expanded-900.ttf"),
  f("Unbounded", 500, "unbounded-500.ttf"),
  f("Unbounded", 800, "unbounded-800.ttf"),
  f("Instrument Serif", 400, "instrument-serif-400.ttf"),
  f("Instrument Serif", 400, "instrument-serif-400-italic.ttf", "italic"),
  f("Caveat", 500, "caveat-500.ttf"),
];

export const fontKey = (family: string, weight: number, style: FontStyle = "normal") =>
  `${family}|${weight}${style === "italic" ? "i" : ""}`;

/** @font-face rules for the browser, pointing at the same files the server uses. */
export function cardFontFaceCss(): string {
  return CARD_FONTS.map(
    (c) =>
      `@font-face{font-family:"${c.family}";font-weight:${c.weight};font-style:${c.style};font-display:block;src:url("/${c.file}") format("truetype");}`,
  ).join("\n");
}

/** Fonts a set of families needs, for preloading / waiting before showing a preview. */
export function fontsFor(families: readonly CardFontFamily[]): CardFont[] {
  return CARD_FONTS.filter((c) => families.includes(c.family));
}

/** CSS font shorthands used with document.fonts.load(). */
export function fontLoadDescriptors(fonts: CardFont[] = CARD_FONTS): string[] {
  return fonts.map((c) => `${c.style === "italic" ? "italic " : ""}${c.weight} 16px "${c.family}"`);
}
