/**
 * Isomorphic text measurement for SVG cards.
 *
 * SVG has no text layout, so templates measure text themselves. Widths come
 * from tables generated out of the exact TTFs the renderer uses
 * (scripts/build-assets.ts), so the browser preview and the server PNG make
 * identical fitting decisions without loading font binaries at runtime.
 */
import metrics from "./font-metrics.generated.json";
import { fontKey, type CardFontFamily, type FontStyle } from "./fonts";

type FontMetrics = {
  unitsPerEm: number;
  fallback: number;
  advances: Record<string, number>;
  kerning: Record<string, number>;
};

const TABLE = metrics as Record<string, FontMetrics>;

export type FontSpec = {
  family: CardFontFamily;
  weight: number;
  style?: FontStyle;
  size: number;
  /** SVG letter-spacing in px, applied after every glyph (as browsers and resvg do). */
  letterSpacing?: number;
};

function table(family: CardFontFamily, weight: number, style: FontStyle = "normal"): FontMetrics {
  const exact = TABLE[fontKey(family, weight, style)];
  if (exact) return exact;
  // Nearest available weight for this family.
  const candidates = Object.keys(TABLE)
    .filter((k) => k.startsWith(`${family}|`))
    .map((k) => ({ k, w: parseInt(k.split("|")[1], 10) }))
    .sort((a, b) => Math.abs(a.w - weight) - Math.abs(b.w - weight));
  if (!candidates.length) throw new Error(`No metrics for font family "${family}"`);
  return TABLE[candidates[0].k];
}

export function measureText(text: string, font: FontSpec): number {
  const m = table(font.family, font.weight, font.style);
  const chars = Array.from(text);
  let units = 0;
  for (let i = 0; i < chars.length; i++) {
    units += m.advances[chars[i]] ?? m.fallback;
    if (i < chars.length - 1) units += m.kerning[chars[i] + chars[i + 1]] ?? 0;
  }
  const spacing = (font.letterSpacing ?? 0) * chars.length;
  return (units / m.unitsPerEm) * font.size + spacing;
}

export type FitOptions = Omit<FontSpec, "size"> & {
  maxWidth: number;
  maxSize: number;
  minSize: number;
  /** letter-spacing expressed relative to size (e.g. -0.02 = -2% of font size). Overrides letterSpacing. */
  trackingEm?: number;
};

export type FitResult = { text: string; size: number; width: number; letterSpacing: number };

/**
 * Largest font size in [minSize, maxSize] at which `text` fits in maxWidth.
 * If it doesn't fit even at minSize, the text is truncated with an ellipsis.
 */
export function fitText(text: string, opts: FitOptions): FitResult {
  const spacingFor = (size: number) =>
    opts.trackingEm !== undefined ? opts.trackingEm * size : (opts.letterSpacing ?? 0);
  const widthAt = (t: string, size: number) =>
    measureText(t, { family: opts.family, weight: opts.weight, style: opts.style, size, letterSpacing: spacingFor(size) });

  const atMax = widthAt(text, opts.maxSize);
  if (atMax <= opts.maxWidth)
    return { text, size: opts.maxSize, width: atMax, letterSpacing: spacingFor(opts.maxSize) };

  // Width scales ~linearly with size; solve, then nudge down for kerning/rounding.
  let size = Math.max(opts.minSize, Math.floor((opts.maxSize * opts.maxWidth) / atMax * 2) / 2);
  while (size > opts.minSize && widthAt(text, size) > opts.maxWidth) size -= 0.5;
  if (widthAt(text, size) <= opts.maxWidth)
    return { text, size, width: widthAt(text, size), letterSpacing: spacingFor(size) };

  // Truncate at minSize.
  const chars = Array.from(text);
  size = opts.minSize;
  while (chars.length > 1) {
    chars.pop();
    const t = chars.join("").trimEnd() + "…";
    const w = widthAt(t, size);
    if (w <= opts.maxWidth) return { text: t, size, width: w, letterSpacing: spacingFor(size) };
  }
  return { text: "…", size, width: widthAt("…", size), letterSpacing: spacingFor(size) };
}
