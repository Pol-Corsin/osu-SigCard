/**
 * Y2K ("Liquid Chrome") — early-2000s gloss as a luxury object.
 * A pearlescent ground, a sculpted liquid-chrome form holding a glass-lens
 * portrait, chrome-plated wide lettering and an iridescent rank, with stats
 * strung along a polished chrome rail.
 *
 * Legibility rules: the chrome name always has a dark extruded edge and
 * outline; on the pale Pearl ground the rank's gradient stops are pulled to
 * ≥3:1 contrast; small text is solid ink, never chrome or gradient.
 */
import { ensureContrast } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Flag, has, pickStats, r2, sparklePath } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const WIDE = "Unbounded" as const;
const LABEL = "Michroma" as const;

const THEMES = {
  pearl: { a: "#ECE7F8", b: "#DCEEF8", c: "#E4F6EE", text: "#22252E", dark: false },
  midnight: { a: "#171A2B", b: "#1D2540", c: "#14202A", text: "#EEF1F8", dark: true },
} as const;
type ThemeId = keyof typeof THEMES;
const theme = (variant: string | null) => THEMES[(variant as ThemeId) in THEMES ? (variant as ThemeId) : "pearl"];

const CHROME: [number, string][] = [
  [0, "#ffffff"], [0.12, "#e2e6ee"], [0.3, "#a2a9b8"], [0.43, "#262a37"], [0.5, "#596071"], [0.6, "#f4f6fa"], [0.76, "#878e9f"], [0.9, "#d9dde6"], [1, "#ffffff"],
];

/** Smooth closed blob through n radial points (Catmull-Rom → cubic Bézier). */
function blobPath(cx: number, cy: number, radius: (a: number) => number, n = 12): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = radius(a);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} ${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d + "Z";
}

function Y2KSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const { width: W, height: H } = size;
  const k = H / 300;
  const v = theme(config.variant);
  const { appearance: ap } = config;
  const { primary, secondary } = config.colors;
  const s = player.stats;
  const px = (n: number) => r2(Math.max(7, n * k));

  const iriA = v.dark ? primary : ensureContrast(primary, v.b, 3);
  const iriB = v.dark ? secondary : ensureContrast(secondary, v.b, 3);
  const edge = v.dark ? "#05060a" : "#262b3a";

  // ---- chrome form + lens
  const cx = 172 * k;
  const cy = 150 * k;
  const R = 82 * k;
  const blob = blobPath(cx, cy, (a) => (124 + 13 * Math.sin(3 * a + 0.9) + 7 * Math.cos(5 * a + 0.3)) * k);
  const inner = blobPath(cx, cy, (a) => (108 + 11 * Math.sin(3 * a + 0.9) + 6 * Math.cos(5 * a + 0.3)) * k);

  // ---- text column
  const X = 352 * k;
  const RIGHT = W - 38 * k;
  const nameY = 120 * k;
  const name = fitText(player.username, { family: WIDE, weight: 800, maxWidth: RIGHT - X, maxSize: 50 * k, minSize: 22 * k, trackingEm: -0.02 });
  // Chrome reflections need room: below 24px the bands crowd the letterforms, so small names are solid ink.
  const chromeName = name.size >= 24;

  const PLACED: StatKey[] = ["globalRank", "countryRank"];
  const regular = pickStats(config, PLACED, 99);
  const heroKey: StatKey | null = has(config, "globalRank") ? "globalRank" : has(config, "countryRank") ? "countryRank" : (regular[0] ?? null);
  const hero = heroKey ? formatStat(heroKey, s) : null;
  const isRank = heroKey === "globalRank" || heroKey === "countryRank";
  const heroText = hero ? (hero.empty ? "Unranked" : hero.value) : "";
  const heroLabel = heroKey === "globalRank" ? "GLOBAL RANK" : heroKey === "countryRank" ? `COUNTRY RANK` : heroKey ? STAT_LABELS[heroKey].label.toUpperCase() : "";
  const sub =
    heroKey === "globalRank" && has(config, "countryRank") ? (s.countryRank == null ? `unranked in ${player.countryCode}` : `#${s.countryRank.toLocaleString("en-US")} ${player.countryCode}`) : null;
  const subSize = 13 * k;
  const subW = sub ? measureText(sub, { family: WIDE, weight: 500, size: subSize }) + 18 * k : 0;
  const rank = fitText(heroText + (!isRank && hero?.unit ? ` ${hero.unit}` : ""), { family: WIDE, weight: 500, maxWidth: RIGHT - X - subW, maxSize: 46 * k, minSize: 24 * k, trackingEm: -0.03 });

  const keys = pickStats(config, [...PLACED, ...(isRank || !heroKey ? [] : [heroKey])], template.statSlots[size.id]);
  const railY = 246 * k;
  const slotW = keys.length ? (RIGHT - X) / keys.length : 0;

  const mode = GAME_MODE_LABELS[player.mode].long.toUpperCase();
  const labelSpec = { family: LABEL, weight: 400, size: px(10), letterSpacing: px(10) * 0.2 } as const;
  const modeW = measureText(mode, labelSpec);
  const showFlag = ap.flag && !!assets.flag;
  const countryX = X + modeW + 22 * k + (showFlag ? 15 * k + 7 * k : 0);

  const stops = CHROME.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={v.a} />
          <stop offset="0.55" stopColor={v.b} />
          <stop offset="1" stopColor={v.c} />
        </linearGradient>
        <linearGradient id={`${id}-horizon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={v.dark ? 0.06 : 0.45} />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-chrome`} x1="0.1" y1="0" x2="0.35" y2="1">{stops}</linearGradient>
        <linearGradient id={`${id}-chrome-rev`} x1="0.3" y1="1" x2="0.05" y2="0">{stops}</linearGradient>
        <linearGradient id={`${id}-type`} x1="0" y1={r2(nameY - name.size * 0.75)} x2="0" y2={r2(nameY)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.42" stopColor={v.dark ? "#c9cfdc" : "#aab2c2"} />
          <stop offset="0.5" stopColor={v.dark ? "#5a6175" : "#2a2f3f"} />
          <stop offset="0.64" stopColor={v.dark ? "#9aa2b6" : "#5d6578"} />
          <stop offset="1" stopColor={v.dark ? "#f4f6fb" : "#d5dae4"} />
        </linearGradient>
        <linearGradient id={`${id}-iri`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={iriA} />
          <stop offset="0.55" stopColor={iriB} />
          <stop offset="1" stopColor={iriA} />
        </linearGradient>
        <radialGradient id={`${id}-gloss`} cx="0.5" cy="0" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-haze`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={r2(26 * k)} />
        </filter>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation={r2(10 * k)} />
        </filter>
        <filter id={`${id}-tshadow`} x="-5%" y="-30%" width="110%" height="170%">
          <feGaussianBlur stdDeviation={r2(2.2 * k)} />
        </filter>
        <clipPath id={`${id}-lens`}>
          <circle cx={r2(cx)} cy={r2(cy)} r={r2(R)} />
        </clipPath>
        <clipPath id={`${id}-card`}>
          <rect width={W} height={H} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-card)`}>
        <rect width={W} height={H} fill={`url(#${id}-ground)`} />
        {ap.effects && (
          <>
            <ellipse cx={r2(560 * k)} cy={r2(40 * k)} rx={r2(260 * k)} ry={r2(70 * k)} fill={primary} opacity={v.dark ? 0.32 : 0.22} filter={`url(#${id}-haze)`} />
            <ellipse cx={r2(W - 80 * k)} cy={r2(280 * k)} rx={r2(220 * k)} ry={r2(80 * k)} fill={secondary} opacity={v.dark ? 0.3 : 0.24} filter={`url(#${id}-haze)`} />
          </>
        )}
        <rect width={W} height={H} fill={`url(#${id}-horizon)`} />

        {/* liquid chrome form */}
        {ap.effects && <path d={blob} transform={`translate(${r2(10 * k)} ${r2(16 * k)})`} fill="#1b1f2c" opacity={0.28} filter={`url(#${id}-shadow)`} />}
        <path d={blob} fill={`url(#${id}-chrome)`} />
        <path d={inner} fill={`url(#${id}-chrome-rev)`} />
        <path d={blob} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={r2(1.2 * k)} />

        {/* glass lens */}
        <circle cx={r2(cx)} cy={r2(cy)} r={r2(R + 5 * k)} fill="#2a2f3d" />
        {ap.avatar && assets.avatar ? (
          <image href={assets.avatar} x={r2(cx - R)} y={r2(cy - R)} width={r2(R * 2)} height={r2(R * 2)} clipPath={`url(#${id}-lens)`} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <g>
            <circle cx={r2(cx)} cy={r2(cy)} r={r2(R)} fill={`url(#${id}-iri)`} />
            <text x={r2(cx)} y={r2(cy + R * 0.3)} textAnchor="middle" fontFamily={WIDE} fontWeight={800} fontSize={r2(R * 0.9)} fill="#ffffff" fillOpacity={0.92}>
              {(player.username.replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase()}
            </text>
          </g>
        )}
        <ellipse cx={r2(cx)} cy={r2(cy - R * 0.52)} rx={r2(R * 0.78)} ry={r2(R * 0.42)} fill={`url(#${id}-gloss)`} clipPath={`url(#${id}-lens)`} />
        <circle cx={r2(cx)} cy={r2(cy)} r={r2(R + 2.5 * k)} fill="none" stroke={`url(#${id}-chrome)`} strokeWidth={r2(5 * k)} />
        {ap.decorations && <path d={sparklePath(r2(cx + R * 0.62), r2(cy - R * 0.74), r2(13 * k))} fill="#ffffff" />}

        {/* header */}
        <text x={r2(X)} y={r2(58 * k)} fill={v.text} fillOpacity={0.75} fontFamily={LABEL} fontSize={px(10)} letterSpacing={r2(px(10) * 0.2)}>
          {mode}
        </text>
        <path d={sparklePath(r2(X + modeW + 10 * k), r2(58 * k - 3.5 * k), r2(5 * k))} fill={iriA} />
        {showFlag && <Flag href={assets.flag} x={r2(X + modeW + 22 * k)} y={r2(58 * k - 9 * k)} w={r2(15 * k)} rx={1} />}
        <text x={r2(countryX)} y={r2(58 * k)} fill={v.text} fillOpacity={0.75} fontFamily={LABEL} fontSize={px(10)} letterSpacing={r2(px(10) * 0.2)}>
          {player.countryName.toUpperCase()}
        </text>

        {/* chrome name: shadow, extruded edge, chrome face */}
        {ap.effects && (
          <text x={r2(X + 1.5 * k)} y={r2(nameY + 3 * k)} fontFamily={WIDE} fontWeight={800} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill="#141826" opacity={v.dark ? 0.6 : 0.35} filter={`url(#${id}-tshadow)`}>
            {name.text}
          </text>
        )}
        <text x={r2(X)} y={r2(nameY + (chromeName ? 2.2 : 1.2) * k)} fontFamily={WIDE} fontWeight={800} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill={edge}>
          {name.text}
        </text>
        <text x={r2(X)} y={r2(nameY)} fontFamily={WIDE} fontWeight={800} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill={chromeName ? `url(#${id}-type)` : v.dark ? "#eef1f8" : "#2a2f3f"} stroke={chromeName ? (v.dark ? "#0b0d14" : "#1f2433") : undefined} strokeWidth={chromeName ? r2(1.1 * k) : undefined}>
          {name.text}
        </text>

        {/* iridescent rank */}
        {hero && (
          <g>
            <text x={r2(X)} y={r2(158 * k)} fill={v.text} fillOpacity={0.65} fontFamily={LABEL} fontSize={px(9)} letterSpacing={r2(px(9) * 0.24)}>
              {heroLabel}
            </text>
            <text x={r2(X - 1)} y={r2(202.6 * k)} fontFamily={WIDE} fontWeight={500} fontSize={rank.size} letterSpacing={r2(rank.letterSpacing)} fill={edge} fillOpacity={v.dark ? 0.9 : 0.3}>
              {rank.text}
            </text>
            <text x={r2(X - 1)} y={r2(201 * k)} fontFamily={WIDE} fontWeight={500} fontSize={rank.size} letterSpacing={r2(rank.letterSpacing)} fill={hero.empty ? v.text : `url(#${id}-iri)`} fillOpacity={hero.empty ? 0.8 : 1}>
              {rank.text}
            </text>
            {!hero.empty && (
              <text x={r2(X - 1)} y={r2(201 * k)} fontFamily={WIDE} fontWeight={500} fontSize={rank.size} letterSpacing={r2(rank.letterSpacing)} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={r2(0.6 * k)}>
                {rank.text}
              </text>
            )}
            {sub && (
              <text x={r2(X + rank.width + 18 * k)} y={r2(200 * k)} fill={v.text} fillOpacity={0.75} fontFamily={WIDE} fontWeight={500} fontSize={r2(subSize)}>
                {sub}
              </text>
            )}
          </g>
        )}

        {/* chrome rail */}
        {keys.length > 0 && <rect x={r2(X)} y={r2(railY - 2 * k)} width={r2(RIGHT - X)} height={r2(4 * k)} rx={r2(2 * k)} fill={`url(#${id}-chrome)`} />}
        {keys.map((key, i) => {
          const st = formatStat(key, s);
          const x = X + i * slotW;
          const unitW = st.unit ? measureText(st.unit, { family: WIDE, weight: 500, size: px(10) }) + 1 : 0;
          const val = fitText(st.value, { family: WIDE, weight: 500, maxWidth: slotW - 22 * k - unitW, maxSize: 15 * k, minSize: 9 * k, trackingEm: -0.01 });
          const lab = fitText(STAT_LABELS[key].label.toUpperCase(), { family: LABEL, weight: 400, maxWidth: slotW - 20 * k, maxSize: px(8.5), minSize: 7, trackingEm: 0.2 });
          return (
            <g key={key}>
              <circle cx={r2(x + 5 * k)} cy={r2(railY)} r={r2(5 * k)} fill={`url(#${id}-chrome-rev)`} stroke="#ffffff" strokeWidth={r2(0.8 * k)} />
              <text x={r2(x + 16 * k)} y={r2(railY + 26 * k)} fill={v.text} fillOpacity={0.65} fontFamily={LABEL} fontSize={lab.size} letterSpacing={r2(lab.letterSpacing)}>
                {lab.text}
              </text>
              <text x={r2(x + 16 * k)} y={r2(railY - 10 * k)} fill={v.text} fillOpacity={st.empty ? 0.55 : 1} fontFamily={WIDE} fontWeight={500} fontSize={val.size} letterSpacing={r2(val.letterSpacing)}>
                {val.text}
                {st.unit && (
                  <tspan fillOpacity={0.6} fontSize={px(10)} letterSpacing={0}>
                    {st.unit}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
        {ap.decorations && <path d={sparklePath(r2(RIGHT - 6 * k), r2(54 * k), r2(7 * k))} fill="#ffffff" opacity={0.95} />}
      </g>
    </svg>
  );
}

export const template: CardTemplate = {
  id: "y2k",
  version: 2,
  name: "Y2K",
  tagline: "Liquid chrome, glass lens and pearl, early-2000s gloss",
  sizes: ["standard", "compact"],
  variants: [
    { id: "pearl", name: "Pearl", description: "Pearlescent lilac, ice and mint" },
    { id: "midnight", name: "Midnight", description: "Deep blue night ground" },
  ],
  defaultVariant: "pearl",
  legacyVariants: { chrome: "pearl", candy: "pearl" },
  heroStats: ["globalRank", "countryRank"],
  statRoles: { globalRank: "Iridescent headline", countryRank: "Beside the headline" },
  ground: (config) => theme(config.variant).b,
  contrastTarget: null,
  statSlots: { standard: 3, compact: 3 },
  supports: { avatarShape: false, cover: false, effects: true, decorations: true },
  fonts: ["Unbounded", "Michroma"],
  Component: Y2KSvg,
};
