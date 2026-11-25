/**
 * SVG building blocks shared by templates. Everything here renders identically
 * in the browser and in resvg (no CSS, no foreignObject, no filters that resvg
 * lacks).
 */
import type { CardConfig } from "../../cards/config";
import { mix, onColor } from "../../color/color";
import type { StatKey } from "../../player/format";
import { measureText, type FontSpec } from "../../render/measure";

export type AvatarShape = "round" | "square" | { rx: number };

type AvatarProps = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  href: string | null;
  /** Used when the image is missing. */
  username: string;
  colors: { a: string; b: string };
  shape?: AvatarShape;
  /** Optional custom clip polygon "x,y x,y …" instead of a rect. */
  polygon?: string;
  monogramFont?: { family: string; weight: number };
};

/**
 * Avatar image, cropped to fill (like CSS object-fit: cover), with a designed
 * monogram fallback when no image is available.
 */
export function Avatar({ id, x, y, w, h, href, username, colors, shape = "square", polygon, monogramFont }: AvatarProps) {
  const rx = shape === "round" ? Math.min(w, h) / 2 : shape === "square" ? 0 : shape.rx;
  const clipId = `${id}-clip`;
  const gradId = `${id}-mono`;
  const initial = (username.replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase();
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          {polygon ? <polygon points={polygon} /> : <rect x={x} y={y} width={w} height={h} rx={rx} />}
        </clipPath>
        {!href && (
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors.a} />
            <stop offset="1" stopColor={colors.b} />
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {href ? (
          <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect x={x} y={y} width={w} height={h} fill={`url(#${gradId})`} />
            <text
              x={x + w / 2}
              y={y + h / 2 + Math.min(w, h) * 0.2}
              textAnchor="middle"
              fontFamily={monogramFont?.family ?? "Hanken Grotesk"}
              fontWeight={monogramFont?.weight ?? 500}
              fontSize={Math.min(w, h) * 0.56}
              fill={onColor(mix(colors.a, colors.b, 0.5))}
              fillOpacity={0.92}
            >
              {initial}
            </text>
          </>
        )}
      </g>
    </g>
  );
}

/** Country flag (3:2) with a hairline edge so white flags read on light grounds. */
export function Flag({ href, x, y, w, rx = 2 }: { href: string | null; x: number; y: number; w: number; rx?: number }) {
  if (!href) return null;
  const h = (w * 2) / 3;
  return (
    <g>
      <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />
      <rect x={x + 0.25} y={y + 0.25} width={w - 0.5} height={h - 0.5} rx={rx} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={0.5} />
    </g>
  );
}

/** Enabled stats in user order, minus the ones a template renders as heroes, capped to its slots. */
export function pickStats(config: CardConfig, exclude: StatKey[], max: number): StatKey[] {
  return config.stats.filter((k) => !exclude.includes(k)).slice(0, max);
}

export const has = (config: CardConfig, key: StatKey) => config.stats.includes(key);

/** Accent falls back to a blend of primary and secondary when the user hasn't set one. */
export function accentOf(config: CardConfig): string {
  return config.colors.accent ?? mix(config.colors.primary, config.colors.secondary, 0.5);
}

/** Split n items into rows of at most `perRow`, balanced so no item sits alone. */
export function balancedRows(n: number, perRow: number): number[] {
  if (n <= 0) return [];
  const rows = Math.ceil(n / perRow);
  const base = Math.floor(n / rows);
  const extra = n % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Deterministic PRNG (mulberry32) so decorative randomness is identical in browser and server. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Four-point sparkle path centred on (cx, cy). */
export function sparklePath(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
}

/** Regular polygon points, first vertex at `startDeg` (−90 = pointing up). */
export function polygonPoints(cx: number, cy: number, r: number, sides: number, startDeg = -90): string {
  return Array.from({ length: sides }, (_, k) => {
    const a = ((startDeg + (360 / sides) * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/**
 * Start x for text that should end exactly at `right`. Use instead of
 * text-anchor="end" for tracked text or text with tspans: browsers and resvg
 * treat the trailing letter-spacing of end-anchored text differently, which
 * shifts it by a pixel or two between the preview and the PNG.
 */
export function rightEdgeX(right: number, text: string, font: FontSpec): number {
  return r2(right - measureText(text, font) + (font.letterSpacing ?? 0));
}

/** Round to 2 decimals so serialized SVG stays compact and stable. */
export const r2 = (n: number) => Math.round(n * 100) / 100;
