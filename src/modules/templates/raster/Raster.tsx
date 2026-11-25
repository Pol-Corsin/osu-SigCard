/**
 * RASTER — Swiss International Style poster.
 * One flat disc of the primary colour rising from the bottom-right corner,
 * a black-and-white duotone portrait captioned like a figure, numbered
 * information columns on a strict left edge, and the rank set so large the
 * card edge crops its foot. Wherever text crosses the disc it is knocked out
 * in the colour that reads best on the disc, so the overlap never costs
 * legibility.
 */
import type { ReactNode } from "react";
import { contrast, ensureContrast } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Flag, has, pickStats, r2 } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const DISPLAY = "Archivo Expanded" as const;
const TEXT = "Hanken Grotesk" as const;

const THEMES = {
  paper: { ground: "#ECEAE3", ink: "#121212" },
  ink: { ground: "#121212", ink: "#ECEAE3" },
} as const;
type ThemeId = keyof typeof THEMES;
const theme = (variant: string | null) => THEMES[(variant as ThemeId) in THEMES ? (variant as ThemeId) : "paper"];

/** feColorMatrix mapping luminance onto a dark → light ramp (duotone). */
function duotone(dark: string, light: string): string {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [d, l] = [c(dark), c(light)];
  const row = (i: number) => {
    const k = l[i] - d[i];
    return `${(0.2126 * k).toFixed(4)} ${(0.7152 * k).toFixed(4)} ${(0.0722 * k).toFixed(4)} 0 ${d[i].toFixed(4)}`;
  };
  return `${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0`;
}

function RasterSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const { width: W, height: H } = size;
  const k = H / 300;
  const t = theme(config.variant);
  const { appearance: ap } = config;
  const s = player.stats;
  const M = 36 * k;

  // The disc must stay visible against the ground, whatever colour is picked.
  const disc = ensureContrast(config.colors.primary, t.ground, 1.35);
  const onDisc = contrast(t.ink, disc) >= contrast(t.ground, disc) ? t.ink : t.ground;
  const D = { cx: W - 140 * k, cy: H + 18 * k, r: 250 * k };

  // Portrait square sitting on the disc's edge.
  const showAvatar = ap.avatar;
  const av = { x: W - 188 * k, y: 36 * k, s: 152 * k };
  const contentRight = showAvatar ? av.x - 28 * k : W - M;

  const px = (n: number) => r2(Math.max(7, n * k));
  const labelFont = (weight = 500) => ({ fontFamily: TEXT, fontWeight: weight, fontSize: px(10), letterSpacing: r2(px(10) * 0.02) });

  // Name
  const name = fitText(player.username.toUpperCase(), { family: DISPLAY, weight: 800, maxWidth: contentRight - M, maxSize: 40 * k, minSize: 18 * k, trackingEm: -0.02 });
  const nameBase = M + name.size * 0.74;

  // Hero: global rank, else country rank, else the first regular stat.
  const PLACED: StatKey[] = ["globalRank", "countryRank"];
  const regular = pickStats(config, PLACED, 99);
  const heroKey: StatKey | null = has(config, "globalRank") ? "globalRank" : has(config, "countryRank") ? "countryRank" : (regular[0] ?? null);
  const hero = heroKey ? formatStat(heroKey, s) : null;
  const isRank = heroKey === "globalRank" || heroKey === "countryRank";
  const heroText = hero ? (hero.empty ? "UNRANKED" : isRank ? hero.value.replace(/^#/, "") : hero.value) : "";
  const heroLabel = heroKey === "globalRank" ? "Global rank" : heroKey === "countryRank" ? `Country rank, ${player.countryName}` : heroKey ? STAT_LABELS[heroKey].label : "";
  const heroFit = fitText(heroText, { family: DISPLAY, weight: 900, maxWidth: Math.min(640 * k, W - M - 40 * k), maxSize: 150 * k, minSize: 70 * k, trackingEm: -0.05 });
  const heroBase = H + heroFit.size * 0.035; // the card edge crops the foot of the numerals
  const heroUnit = !isRank && hero?.unit ? hero.unit : null;

  // Meta line: mode · country · national rank (when it isn't the hero)
  const showFlag = ap.flag && !!assets.flag;
  const metaY = nameBase + 22 * k;
  const metaParts = [
    GAME_MODE_LABELS[player.mode].long,
    player.countryName,
    heroKey !== "countryRank" && has(config, "countryRank") ? (s.countryRank == null ? "unranked nationally" : `#${s.countryRank.toLocaleString("en-US")} national`) : null,
  ].filter((p): p is string => !!p);

  // Numbered columns
  const cols = pickStats(config, [...PLACED, ...(isRank || !heroKey ? [] : [heroKey])], template.statSlots[size.id]);
  const colW = Math.min(150 * k, (contentRight - M + 18 * k) / Math.max(cols.length, 1));
  const colTop = 118 * k;

  // Caption under the portrait
  const captionFont = { family: TEXT, weight: 500, size: px(10), letterSpacing: px(10) * 0.02 } as const;
  const captionRoom = W - (av.x + 40 * k) - 12 * k;
  const full = `${player.username}, ${player.countryName}`;
  const caption = measureText(full, captionFont) <= captionRoom ? full : fitText(player.username, { family: TEXT, weight: 500, maxWidth: captionRoom, maxSize: px(10), minSize: px(10) }).text;

  const clipDisc = `url(#${id}-disc)`;
  /** Draws text normally, then again clipped to the disc in the knock-out colour. */
  const knock = (node: (fill: string) => ReactNode, fill: string) => (
    <>
      {node(fill)}
      <g clipPath={clipDisc}>{node(onDisc)}</g>
    </>
  );

  let metaX = M + (showFlag ? 18 * k + 8 * k : 0);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <filter id={`${id}-duo`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={duotone("#121212", "#ECEAE3")} />
          <feComponentTransfer>
            <feFuncR type="linear" slope={1.25} intercept={-0.1} />
            <feFuncG type="linear" slope={1.25} intercept={-0.1} />
            <feFuncB type="linear" slope={1.25} intercept={-0.1} />
          </feComponentTransfer>
        </filter>
        <clipPath id={`${id}-card`}>
          <rect width={W} height={H} />
        </clipPath>
        <clipPath id={`${id}-disc`}>
          <circle cx={r2(D.cx)} cy={r2(D.cy)} r={r2(D.r)} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-card)`}>
        <rect width={W} height={H} fill={t.ground} />
        <circle cx={r2(D.cx)} cy={r2(D.cy)} r={r2(D.r)} fill={disc} />

        {/* portrait */}
        {showAvatar &&
          (assets.avatar ? (
            <image href={assets.avatar} x={r2(av.x)} y={r2(av.y)} width={r2(av.s)} height={r2(av.s)} preserveAspectRatio="xMidYMid slice" filter={ap.effects ? `url(#${id}-duo)` : undefined} />
          ) : (
            <g>
              <rect x={r2(av.x)} y={r2(av.y)} width={r2(av.s)} height={r2(av.s)} fill={t.ink} />
              <text x={r2(av.x + av.s / 2)} y={r2(av.y + av.s * 0.7)} textAnchor="middle" fontFamily={DISPLAY} fontWeight={900} fontSize={r2(av.s * 0.6)} fill={t.ground}>
                {(player.username.replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase()}
              </text>
            </g>
          ))}
        {showAvatar &&
          ap.decorations &&
          knock(
            (fill) => (
              <g>
                <text x={r2(av.x)} y={r2(av.y + av.s + 16 * k)} fill={fill} {...labelFont(600)}>
                  Fig. 1
                </text>
                <text x={r2(av.x + 40 * k)} y={r2(av.y + av.s + 16 * k)} fill={fill} fillOpacity={0.8} {...labelFont()}>
                  {caption}
                </text>
              </g>
            ),
            t.ink,
          )}

        {/* name + meta */}
        <text x={r2(M - 1)} y={r2(nameBase)} fontFamily={DISPLAY} fontWeight={800} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill={t.ink}>
          {name.text}
        </text>
        {showFlag && <Flag href={assets.flag} x={r2(M)} y={r2(metaY - 8 * k)} w={r2(18 * k)} rx={0} />}
        {metaParts.map((p, i) => {
          const x = metaX;
          metaX += measureText(p, captionFont) + 22 * k;
          return (
            <g key={i}>
              {i > 0 && ap.decorations && <rect x={r2(x - 13.5 * k)} y={r2(metaY - 7 * k)} width={r2(5 * k)} height={r2(5 * k)} fill={disc} />}
              <text x={r2(x)} y={r2(metaY)} fill={t.ink} fillOpacity={0.8} {...labelFont()}>
                {p}
              </text>
            </g>
          );
        })}

        {/* numbered columns */}
        {cols.map((key, i) => {
          const st = formatStat(key, s);
          const x = M + i * colW;
          const unitW = st.unit ? measureText(st.unit, { family: TEXT, weight: 500, size: px(11) }) + 2 : 0;
          const v = fitText(st.value, { family: DISPLAY, weight: 800, maxWidth: colW - 18 * k - unitW, maxSize: 19 * k, minSize: 12 * k, trackingEm: -0.02 });
          return (
            <g key={key}>
              <line x1={r2(x)} y1={r2(colTop)} x2={r2(x + colW - 18 * k)} y2={r2(colTop)} stroke={t.ink} strokeWidth={r2(1.5 * k)} />
              <text x={r2(x)} y={r2(colTop + 15 * k)} fill={t.ink} {...labelFont(600)}>
                {String(i + 1).padStart(2, "0")}
              </text>
              <text x={r2(x + 22 * k)} y={r2(colTop + 15 * k)} fill={t.ink} fillOpacity={0.75} {...labelFont()}>
                {STAT_LABELS[key].label}
              </text>
              <text x={r2(x)} y={r2(colTop + 40 * k)} fontFamily={DISPLAY} fontWeight={800} fontSize={v.size} letterSpacing={r2(v.letterSpacing)} fill={t.ink} fillOpacity={st.empty ? 0.5 : 1}>
                {v.text}
                {st.unit && (
                  <tspan fontFamily={TEXT} fontWeight={500} fontSize={px(11)} letterSpacing={0} dx={2}>
                    {st.unit}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}

        {/* the numeral */}
        {hero && (
          <g>
            <text x={r2(M)} y={r2(186 * k)} fill={t.ink} {...labelFont()}>
              {heroLabel}
            </text>
            {knock(
              (fill) => (
                <text x={r2(M - heroFit.size * 0.04)} y={r2(heroBase)} fontFamily={DISPLAY} fontWeight={900} fontSize={heroFit.size} letterSpacing={r2(heroFit.letterSpacing)} fill={fill}>
                  {heroFit.text}
                  {heroUnit && (
                    <tspan fontFamily={TEXT} fontWeight={500} fontSize={r2(heroFit.size * 0.22)} letterSpacing={0} dx={r2(6 * k)}>
                      {heroUnit}
                    </tspan>
                  )}
                </text>
              ),
              t.ink,
            )}
          </g>
        )}
      </g>
    </svg>
  );
}

export const template: CardTemplate = {
  id: "raster",
  version: 1,
  name: "Raster",
  tagline: "Swiss poster: one disc of colour, a rank too big for the card",
  sizes: ["standard", "compact"],
  variants: [
    { id: "paper", name: "Paper", description: "Poster paper, black ink" },
    { id: "ink", name: "Ink", description: "Black ground, paper-white type" },
  ],
  defaultVariant: "paper",
  heroStats: ["globalRank", "countryRank"],
  statRoles: { globalRank: "Poster numeral", countryRank: "Meta line" },
  ground: (config) => theme(config.variant).ground,
  contrastTarget: null,
  statSlots: { standard: 3, compact: 3 },
  supports: { avatarShape: false, cover: false, effects: true, decorations: true },
  fonts: ["Archivo Expanded", "Hanken Grotesk"],
  Component: RasterSvg,
};
