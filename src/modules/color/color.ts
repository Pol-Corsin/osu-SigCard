/**
 * Small, dependency-free color utilities used by templates and the editor.
 * All inputs are #RRGGBB hex strings (normalize user input with normalizeHex).
 */
export type Hex = `#${string}`;

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(input: string): Hex | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): Hex {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix in sRGB. t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): Hex {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Returns `fg` unchanged if it reaches `min` contrast against `bg`; otherwise
 * moves it toward black or white (whichever direction gains contrast) in small
 * steps until it does. Keeps the hue recognisable instead of snapping to black/white.
 */
export function ensureContrast(fg: string, bg: string, min: number): Hex {
  const start = normalizeHex(fg) ?? "#ffffff";
  if (contrast(start, bg) >= min) return start;
  const target = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(start, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

/** Best of near-white / near-black text on a given background. */
export function onColor(bg: string, light = "#ffffff", dark = "#111014"): Hex {
  return (contrast(light, bg) >= contrast(dark, bg) ? light : dark) as Hex;
}

/** Scale saturation/lightness feel by mixing toward a neutral. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
