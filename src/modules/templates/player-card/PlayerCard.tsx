/**
 * PLAYER CARD — esports roster card.
 * Full-height portrait cut by a slanted team stripe, condensed display type,
 * global rank as the hero number, remaining stats in a balanced box grid.
 */
import { ensureContrast, mix } from "../../color/color";
import { formatStat, STAT_LABELS } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Avatar, balancedRows, Flag, has, pickStats } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const FONT = "Saira Condensed" as const;

const LAYOUT = {
  standard: {
    panelTop: 318, slant: 60, stripe: 18, stripe2: { gap: 8, w: 5 },
    x0: 380, x1: 872,
    chip: { y: 28, h: 22, size: 12 },
    rankLabel: { y: 64, size: 11 },
    baseline: 120, name: { max: 78, min: 36 }, rank: { max: 60, min: 40, maxWidth: 230 },
    grid: { bottom: 280, rowH: 62, singleH: 84, gap: 10, label: 11, value: 30, unit: 15 },
    lower: { x: 24, bottom: 278, flagW: 30, country: 17, mode: 12 },
    stripes: { x: 776, count: 9, len: 40 },
  },
  compact: {
    panelTop: 214, slant: 40, stripe: 12, stripe2: { gap: 6, w: 4 },
    x0: 256, x1: 616,
    chip: { y: 18, h: 18, size: 10 },
    rankLabel: { y: 44, size: 9.5 },
    baseline: 84, name: { max: 52, min: 26 }, rank: { max: 42, min: 28, maxWidth: 150 },
    grid: { bottom: 184, rowH: 74, singleH: 74, gap: 8, label: 9.5, value: 26, unit: 13 },
    lower: { x: 16, bottom: 186, flagW: 22, country: 13, mode: 9.5 },
    stripes: { x: 530, count: 7, len: 28 },
  },
};

function PlayerCardSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const L = LAYOUT[size.id];
  const { width: W, height: H } = size;
  const { appearance: ap, colors } = config;

  const bg = template.ground(config);
  const text = "#f6f5fa";
  const muted = "#8f8c9c";
  const pc = ensureContrast(colors.primary, bg, 3.5);
  const sc = ensureContrast(colors.secondary, bg, 3.5);
  const panelBottom = L.panelTop - L.slant;
  const panel = `0,0 ${L.panelTop},0 ${panelBottom},${H} 0,${H}`;

  // ---- hero: global rank ----
  const showRank = has(config, "globalRank");
  const rankStat = formatStat("globalRank", player.stats);
  const rankFit = showRank
    ? fitText(rankStat.value, { family: FONT, weight: 800, maxWidth: L.rank.maxWidth, maxSize: L.rank.max, minSize: L.rank.min })
    : null;

  // ---- username ----
  const nameMaxWidth = L.x1 - L.x0 - (rankFit ? rankFit.width + 28 : 0);
  const name = fitText(player.username.toUpperCase(), {
    family: FONT, weight: 800, maxWidth: nameMaxWidth, maxSize: L.name.max, minSize: L.name.min, trackingEm: 0.005,
  });

  // ---- mode chip ----
  const modeText = GAME_MODE_LABELS[player.mode].long;
  const chipW = measureText(modeText, { family: FONT, weight: 600, size: L.chip.size, letterSpacing: 1.2 }) + 20;

  // ---- stat grid ----
  const keys = pickStats(config, ["globalRank"], template.statSlots[size.id]);
  const rows = balancedRows(keys.length, 3);
  const g = L.grid;
  const rowH = rows.length === 1 ? g.singleH : g.rowH;
  const gridTop = g.bottom - rows.length * rowH - (rows.length - 1) * g.gap;
  const gridW = L.x1 - L.x0;

  let k = 0;
  const boxes = rows.flatMap((count, r) => {
    const bw = (gridW - (count - 1) * g.gap) / count;
    return Array.from({ length: count }, (_, c) => {
      const key = keys[k++];
      const st = formatStat(key, player.stats);
      const bx = L.x0 + c * (bw + g.gap);
      const by = gridTop + r * (rowH + g.gap);
      const unitW = st.unit ? measureText(st.unit, { family: FONT, weight: 700, size: g.unit }) + 3 : 0;
      const val = fitText(st.value, { family: FONT, weight: 800, maxWidth: bw - 28 - unitW, maxSize: g.value, minSize: g.value * 0.6 });
      const label =
        key === "countryRank"
          ? `COUNTRY · ${player.countryCode}`
          : key === "level"
            ? `LEVEL · ${player.stats.level.progress}%`
            : STAT_LABELS[key].label.toUpperCase();
      const valueY = by + rowH - (rowH - g.value) / 2 + 2;
      const labelY = by + g.label + 10;
      return (
        <g key={key}>
          <rect x={bx} y={by} width={bw} height={rowH} fill={bg} fillOpacity={0.55} />
          <rect x={bx} y={by} width={bw} height={rowH} fill="#ffffff" fillOpacity={0.05} />
          {ap.decorations && <path d={`M${bx + bw - 12} ${by}H${bx + bw}V${by + 12}Z`} fill={pc} />}
          <text x={bx + 14} y={labelY} fontFamily={FONT} fontWeight={600} fontSize={g.label} letterSpacing={2} fill={muted}>
            {label}
          </text>
          <text x={bx + 14} y={valueY} fontFamily={FONT} fontWeight={800} fontSize={val.size} fill={st.empty ? muted : text}>
            {val.text}
            {st.unit && (
              <tspan fontWeight={700} fontSize={g.unit} fill={muted} dx={3}>
                {st.unit}
              </tspan>
            )}
          </text>
          {key === "level" && (
            <g>
              <rect x={bx} y={by + rowH - 3} width={bw} height={3} fill="#ffffff" fillOpacity={0.1} />
              <rect x={bx} y={by + rowH - 3} width={(bw * player.stats.level.progress) / 100} height={3} fill={pc} />
            </g>
          )}
        </g>
      );
    });
  });

  // ---- lower third over the portrait ----
  const lw = panelBottom - L.lower.x - 16;
  const showFlag = ap.flag && !!assets.flag;
  const flagH = (L.lower.flagW * 2) / 3;
  const countryX = L.lower.x + (showFlag ? L.lower.flagW + 10 : 0);
  const country = fitText(player.countryName.toUpperCase(), {
    family: FONT, weight: 700, maxWidth: lw - (countryX - L.lower.x), maxSize: L.lower.country, minSize: L.lower.country * 0.7, letterSpacing: 1,
  });
  const lowerTitleY = L.lower.bottom - 2;

  const coverOn = ap.cover && !!assets.cover;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.42" stopColor={bg} stopOpacity={0} />
          <stop offset="1" stopColor={bg} stopOpacity={0.94} />
        </linearGradient>
        <linearGradient id={`${id}-tint`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={colors.primary} stopOpacity={0.34} />
          <stop offset="0.6" stopColor={colors.primary} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-coverfade`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={bg} stopOpacity={0.97} />
          <stop offset="0.55" stopColor={bg} stopOpacity={0.9} />
          <stop offset="1" stopColor={bg} stopOpacity={0.78} />
        </linearGradient>
        <filter id={`${id}-mute`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0.3" />
        </filter>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={colors.primary} stopOpacity={0.2} />
          <stop offset="1" stopColor={colors.primary} stopOpacity={0} />
        </radialGradient>
        <pattern id={`${id}-scan`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="#000" fillOpacity={0.22} />
        </pattern>
        <pattern id={`${id}-dots`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.1" fill={sc} fillOpacity={0.16} />
        </pattern>
        <linearGradient id={`${id}-dotfade`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#fff" stopOpacity={1} />
        </linearGradient>
        <mask id={`${id}-dotmask`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill={`url(#${id}-dotfade)`} />
        </mask>
      </defs>

      {/* ground */}
      <rect width={W} height={H} fill={bg} />
      {coverOn && (
        <g>
          <image href={assets.cover!} x={panelBottom} y={0} width={W - panelBottom} height={H} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-mute)`} />
          <rect x={panelBottom} y={0} width={W - panelBottom} height={H} fill={`url(#${id}-coverfade)`} />
        </g>
      )}
      {ap.effects && (
        <g>
          <ellipse cx={L.x0 + (L.x1 - L.x0) * 0.32} cy={H * 0.3} rx={W * 0.34} ry={H * 0.62} fill={`url(#${id}-glow)`} />
          <rect width={W} height={H} fill={`url(#${id}-dots)`} mask={`url(#${id}-dotmask)`} />
        </g>
      )}
      {ap.decorations &&
        Array.from({ length: L.stripes.count }, (_, i) => (
          <path
            key={i}
            d={`M${L.stripes.x + i * (L.stripes.len * 0.35)} 0h${L.stripes.len * 0.15}l${-L.stripes.len} ${L.stripes.len}h${-L.stripes.len * 0.15}z`}
            fill={sc}
            fillOpacity={0.24}
          />
        ))}

      {/* portrait */}
      <Avatar
        id={`${id}-av`}
        x={0}
        y={0}
        w={L.panelTop}
        h={H}
        polygon={panel}
        href={ap.avatar ? assets.avatar : null}
        username={player.username}
        colors={{ a: colors.primary, b: mix(colors.secondary, bg, 0.35) }}
        monogramFont={{ family: FONT, weight: 800 }}
      />
      <g clipPath={`url(#${id}-av-clip)`}>
        {ap.effects && <rect width={L.panelTop} height={H} fill={`url(#${id}-tint)`} />}
        {ap.effects && <rect width={L.panelTop} height={H} fill={`url(#${id}-scan)`} />}
        <rect width={L.panelTop} height={H} fill={`url(#${id}-shade)`} />
      </g>

      {/* team stripes along the cut */}
      <polygon points={`${L.panelTop},0 ${L.panelTop + L.stripe},0 ${panelBottom + L.stripe},${H} ${panelBottom},${H}`} fill={pc} />
      {ap.decorations && (
        <polygon
          points={`${L.panelTop + L.stripe + L.stripe2.gap},0 ${L.panelTop + L.stripe + L.stripe2.gap + L.stripe2.w},0 ${panelBottom + L.stripe + L.stripe2.gap + L.stripe2.w},${H} ${panelBottom + L.stripe + L.stripe2.gap},${H}`}
          fill={sc}
        />
      )}

      {/* lower third */}
      {showFlag && <Flag href={assets.flag} x={L.lower.x} y={lowerTitleY - flagH + 1} w={L.lower.flagW} />}
      <text x={countryX} y={lowerTitleY} fontFamily={FONT} fontWeight={700} fontSize={country.size} letterSpacing={1} fill={text}>
        {country.text}
      </text>

      {/* header */}
      <rect x={L.x0 + 0.5} y={L.chip.y + 0.5} width={chipW} height={L.chip.h} rx={2} fill="none" stroke={sc} />
      <text x={L.x0 + 0.5 + chipW / 2} y={L.chip.y + L.chip.h / 2 + L.chip.size * 0.36} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={L.chip.size} letterSpacing={1.2} fill={sc}>
        {modeText}
      </text>

      <text x={L.x0 - 3} y={L.baseline} fontFamily={FONT} fontWeight={800} fontSize={name.size} letterSpacing={name.letterSpacing} fill={text}>
        {name.text}
      </text>

      {rankFit && (
        <g>
          <text x={L.x1} y={L.rankLabel.y} textAnchor="end" fontFamily={FONT} fontWeight={600} fontSize={L.rankLabel.size} letterSpacing={3} fill={muted}>
            GLOBAL RANK
          </text>
          <text x={L.x1 + 2} y={L.baseline} textAnchor="end" fontFamily={FONT} fontWeight={800} fontSize={rankFit.size} fill={rankStat.empty ? muted : pc}>
            {rankFit.text}
          </text>
        </g>
      )}

      {boxes}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "playerCard",
  version: 1,
  name: "Player Card",
  tagline: "Esports roster card with a full-height portrait",
  sizes: ["standard", "compact"],
  variants: [],
  defaultVariant: null,
  heroStats: ["globalRank"],
  statRoles: { globalRank: "Headline" },
  ground: (config) => mix("#0b0b10", config.colors.secondary, 0.06),
  contrastTarget: 3.5,
  statSlots: { standard: 6, compact: 3 },
  supports: { avatarShape: false, cover: true, effects: true, decorations: true },
  fonts: ["Saira Condensed"],
  Component: PlayerCardSvg,
};
