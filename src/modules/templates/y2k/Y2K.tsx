/**
 * Y2K — a retro-futurist desktop.
 *
 * Brushed-chrome ground with iridescent colour blooms, a translucent window
 * titled "<name>.sig", a glossy bubble avatar, chrome lettering, stats as
 * pill capsules, level as a chunky progress bar, and four-point sparkles.
 */
import { contrast, mix, onColor } from "../../color/color";
import { formatStat, STAT_LABELS } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { accentOf, Avatar, Flag, has, pickStats, r2, sparklePath } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const DISPLAY = "Michroma" as const;
const MONO = "Space Mono" as const;

const LAYOUT = {
  standard: {
    win: { x: 26, y: 24, w: 848, h: 252, r: 20, bar: 34 },
    title: { size: 11.5 },
    avatar: { cx: 128, cy: 168, r: 64 },
    x: 222,
    name: { baseline: 136, max: 34, min: 16 },
    sub: { y: 162, size: 12, flagW: 16 },
    pills: { y: 186, h: 36, size: 13, gap: 10, pad: 17 },
    rank: { x1: 848, labelY: 98, baseline: 146, max: 40, min: 22, maxWidth: 250, sub: 12, subY: 170 },
    level: { y: 242, h: 12, w: 300, size: 10 },
    sparkles: [[628, 96, 15], [712, 236, 10], [196, 250, 7], [590, 62, 7], [862, 230, 9]] as [number, number, number][],
  },
  compact: {
    win: { x: 14, y: 14, w: 612, h: 172, r: 14, bar: 24 },
    title: { size: 8.5 },
    avatar: { cx: 78, cy: 110, r: 42 },
    x: 138,
    name: { baseline: 82, max: 24, min: 12 },
    sub: { y: 100, size: 9, flagW: 12 },
    pills: { y: 112, h: 26, size: 10, gap: 7, pad: 11 },
    rank: { x1: 604, labelY: 60, baseline: 90, max: 26, min: 15, maxWidth: 160, sub: 9, subY: 106 },
    level: { y: 156, h: 9, w: 200, size: 8 },
    sparkles: [[452, 58, 10], [520, 160, 7], [130, 168, 5], [600, 150, 6]] as [number, number, number][],
  },
};

function Y2KSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const L = LAYOUT[size.id];
  const { width: W, height: H } = size;
  const { appearance: ap, colors } = config;
  const candy = config.variant === "candy";
  const accent = accentOf(config);

  const ink = "#1c2029";
  const inkSoft = "#3b4150";
  const barMid = mix(colors.primary, colors.secondary, 0.5);
  const barInk = onColor(barMid, "#ffffff", ink);
  const pillGradInk = onColor(mix(colors.primary, colors.secondary, 0.3), "#ffffff", ink);
  const Wn = L.win;

  // ---- title bar ----
  const title = fitText(`${player.username}.sig`, { family: DISPLAY, weight: 400, maxWidth: Wn.w - 120, maxSize: L.title.size, minSize: L.title.size * 0.8 });

  // ---- rank block ----
  const showRank = has(config, "globalRank");
  const rankStat = formatStat("globalRank", player.stats);
  const rank = showRank ? fitText(rankStat.value, { family: DISPLAY, weight: 400, maxWidth: L.rank.maxWidth, maxSize: L.rank.max, minSize: L.rank.min }) : null;
  const showCountry = has(config, "countryRank");

  // ---- name ----
  const nameMax = (rank ? L.rank.x1 - rank.width - 30 : Wn.x + Wn.w - 24) - L.x;
  const name = fitText(player.username, { family: DISPLAY, weight: 400, maxWidth: nameMax, maxSize: L.name.max, minSize: L.name.min });
  const showFlag = ap.flag && !!assets.flag;
  const sub = fitText(`${GAME_MODE_LABELS[player.mode].long} · ${player.countryName}`, {
    family: MONO, weight: 400, maxWidth: nameMax - (showFlag ? L.sub.flagW + 8 : 0), maxSize: L.sub.size, minSize: L.sub.size * 0.75,
  });

  // ---- pills: measure, then drop trailing pills that don't fit ----
  const P = L.pills;
  const all = pickStats(config, template.heroStats, template.statSlots[size.id]).map((k) => {
    const s = formatStat(k, player.stats);
    const t = `${s.value}${s.unit === "%" ? "%" : s.unit ? " " + s.unit : ""} ${s.unit ? "" : STAT_LABELS[k].short.toLowerCase()}`.trim();
    return { k, t, empty: s.empty };
  });
  const maxRight = Wn.x + Wn.w - 24;
  let px = L.x;
  const pills = [] as { k: string; t: string; x: number; w: number; empty?: boolean }[];
  for (const p of all) {
    const w = measureText(p.t, { family: MONO, weight: 700, size: P.size }) + P.pad * 2;
    if (px + w > maxRight) break;
    pills.push({ ...p, x: px, w });
    px += w + P.gap;
  }

  // ---- level progress bar ----
  const showLevel = has(config, "level");
  const LV = L.level;
  const blocks = 20;
  const lit = Math.round((player.stats.level.progress / 100) * blocks);
  const blockW = (LV.w - (blocks - 1) * 2) / blocks;

  const ground1 = candy ? mix("#fde7f3", colors.primary, 0.12) : "#f3f5f8";
  const ground2 = candy ? mix("#d9d2ff", colors.secondary, 0.18) : "#aab2bf";
  const ground3 = candy ? mix("#ffffff", colors.secondary, 0.1) : "#d3d8e0";
  const coverOn = ap.cover && !!assets.cover;
  const A = L.avatar;
  const square = ap.avatarShape === "square";

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ground1} />
          <stop offset="0.46" stopColor={ground2} />
          <stop offset="0.54" stopColor={ground3} />
          <stop offset="1" stopColor={ground1} />
        </linearGradient>
        <linearGradient id={`${id}-type`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4252" />
          <stop offset="0.5" stopColor="#0b0e14" />
          <stop offset="0.55" stopColor="#5d6679" />
          <stop offset="1" stopColor="#1a1e27" />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={colors.primary} />
          <stop offset="1" stopColor={colors.secondary} />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.75} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        <filter id={`${id}-bloom`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={size.id === "standard" ? 28 : 20} />
        </filter>
        <filter id={`${id}-wall`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={2} />
        </filter>
        <clipPath id={`${id}-win`}>
          <rect x={Wn.x} y={Wn.y} width={Wn.w} height={Wn.h} rx={Wn.r} />
        </clipPath>
      </defs>

      <rect width={W} height={H} fill={`url(#${id}-chrome)`} />
      {ap.effects && (
        <g filter={`url(#${id}-bloom)`}>
          <circle cx={W * 0.85} cy={H * 0.22} r={H * 0.37} fill={colors.primary} fillOpacity={0.6} />
          <circle cx={W * 0.67} cy={H * 0.98} r={H * 0.4} fill={colors.secondary} fillOpacity={0.6} />
          <circle cx={W * 0.12} cy={H * 0.12} r={H * 0.24} fill={accent} fillOpacity={0.45} />
        </g>
      )}

      {/* window */}
      <rect x={Wn.x} y={Wn.y} width={Wn.w} height={Wn.h} rx={Wn.r} fill="#ffffff" fillOpacity={0.36} />
      {coverOn && (
        <g clipPath={`url(#${id}-win)`} opacity={0.16}>
          <image href={assets.cover!} x={Wn.x} y={Wn.y + Wn.bar} width={Wn.w} height={Wn.h - Wn.bar} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-wall)`} />
        </g>
      )}
      <g clipPath={`url(#${id}-win)`}>
        <rect x={Wn.x} y={Wn.y} width={Wn.w} height={Wn.bar} fill={`url(#${id}-bar)`} />
        <rect x={Wn.x} y={Wn.y} width={Wn.w} height={Wn.bar * 0.45} fill="#ffffff" fillOpacity={0.28} />
      </g>
      <rect x={Wn.x} y={Wn.y} width={Wn.w} height={Wn.h} rx={Wn.r} fill="none" stroke="#ffffff" strokeWidth={1.5} />
      <text x={Wn.x + 22} y={Wn.y + Wn.bar / 2 + title.size * 0.38} fontFamily={DISPLAY} fontWeight={400} fontSize={title.size} fill={barInk}>
        {title.text}
      </text>
      {ap.decorations &&
        [0, 1, 2].map((i) => (
          <circle key={i} cx={Wn.x + Wn.w - 22 - i * 20} cy={Wn.y + Wn.bar / 2} r={Wn.bar * 0.18} fill="#ffffff" fillOpacity={0.85} stroke={ink} strokeOpacity={0.15} />
        ))}

      {/* bubble avatar */}
      {ap.avatar ? (
        <Avatar
          id={`${id}-av`}
          x={A.cx - A.r}
          y={A.cy - A.r}
          w={A.r * 2}
          h={A.r * 2}
          shape={square ? { rx: A.r * 0.42 } : "round"}
          href={assets.avatar}
          username={player.username}
          colors={{ a: colors.primary, b: colors.secondary }}
          monogramFont={{ family: DISPLAY, weight: 400 }}
        />
      ) : (
        <rect x={A.cx - A.r} y={A.cy - A.r} width={A.r * 2} height={A.r * 2} rx={square ? A.r * 0.42 : A.r} fill={`url(#${id}-bar)`} />
      )}
      <rect x={A.cx - A.r} y={A.cy - A.r} width={A.r * 2} height={A.r * 2} rx={square ? A.r * 0.42 : A.r} fill="none" stroke="#ffffff" strokeWidth={3} />
      <ellipse cx={A.cx - A.r * 0.25} cy={A.cy - A.r * 0.55} rx={A.r * 0.55} ry={A.r * 0.22} fill={`url(#${id}-gloss)`} transform={`rotate(-18 ${A.cx - A.r * 0.25} ${A.cy - A.r * 0.55})`} />

      {/* name + sub */}
      <text x={L.x} y={L.name.baseline + 1.2} fontFamily={DISPLAY} fontWeight={400} fontSize={name.size} fill="#ffffff" fillOpacity={0.85}>
        {name.text}
      </text>
      <text x={L.x} y={L.name.baseline} fontFamily={DISPLAY} fontWeight={400} fontSize={name.size} fill={`url(#${id}-type)`}>
        {name.text}
      </text>
      {showFlag && <Flag href={assets.flag} x={L.x + 1} y={L.sub.y - L.sub.size * 0.82} w={L.sub.flagW} rx={1.5} />}
      <text x={L.x + (showFlag ? L.sub.flagW + 8 : 0)} y={L.sub.y} fontFamily={MONO} fontWeight={400} fontSize={sub.size} fill={inkSoft}>
        {sub.text}
      </text>

      {/* pills */}
      {pills.map((p, i) => (
        <g key={p.k}>
          <rect x={r2(p.x)} y={P.y} width={r2(p.w)} height={P.h} rx={P.h / 2} fill={i === 0 ? `url(#${id}-bar)` : "#ffffff"} fillOpacity={i === 0 ? 1 : 0.72} stroke="#ffffff" strokeWidth={1.2} />
          <rect x={r2(p.x + 4)} y={P.y + 2} width={r2(p.w - 8)} height={P.h * 0.42} rx={P.h * 0.21} fill="#ffffff" fillOpacity={i === 0 ? 0.3 : 0.45} />
          <text x={r2(p.x + p.w / 2)} y={r2(P.y + P.h / 2 + P.size * 0.36)} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={P.size} fill={i === 0 ? pillGradInk : p.empty ? inkSoft : ink}>
            {p.t}
          </text>
        </g>
      ))}

      {/* rank */}
      {rank && (
        <g>
          <text x={L.rank.x1} y={L.rank.labelY} textAnchor="end" fontFamily={DISPLAY} fontWeight={400} fontSize={L.rank.sub * 0.85} letterSpacing={3} fill={inkSoft}>
            GLOBAL
          </text>
          <text x={L.rank.x1 + 2} y={L.rank.baseline + 1.2} textAnchor="end" fontFamily={DISPLAY} fontWeight={400} fontSize={rank.size} fill="#ffffff" fillOpacity={0.85}>
            {rank.text}
          </text>
          <text x={L.rank.x1 + 2} y={L.rank.baseline} textAnchor="end" fontFamily={DISPLAY} fontWeight={400} fontSize={rank.size} fill={`url(#${id}-type)`}>
            {rank.text}
          </text>
          {showCountry && (
            <text x={L.rank.x1} y={L.rank.subY} textAnchor="end" fontFamily={MONO} fontWeight={400} fontSize={L.rank.sub} fill={inkSoft}>
              {`${formatStat("countryRank", player.stats).value} ${player.countryCode}`}
            </text>
          )}
        </g>
      )}

      {/* level progress */}
      {showLevel && (
        <g>
          <rect x={L.x - 3} y={LV.y - 3} width={LV.w + 6} height={LV.h + 6} rx={3} fill="#ffffff" fillOpacity={0.6} stroke="#ffffff" />
          {Array.from({ length: blocks }, (_, i) => (
            <rect key={i} x={r2(L.x + i * (blockW + 2))} y={LV.y} width={r2(blockW)} height={LV.h} rx={1} fill={i < lit ? `url(#${id}-bar)` : ink} fillOpacity={i < lit ? 1 : 0.08} />
          ))}
          <text x={L.x + LV.w + 14} y={LV.y + LV.h - 1} fontFamily={MONO} fontWeight={700} fontSize={LV.size} fill={inkSoft}>
            {`LV.${player.stats.level.current}  ${player.stats.level.progress}%`}
          </text>
        </g>
      )}

      {ap.decorations &&
        L.sparkles.map(([x, y, r], i) => (
          <path key={i} d={sparklePath(x, y, r)} fill={i === 3 ? colors.primary : i === 4 ? colors.secondary : "#ffffff"} fillOpacity={contrast("#ffffff", ground1) > 1.2 ? 1 : 0.95} />
        ))}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "y2k",
  version: 1,
  name: "Y2K",
  tagline: "Chrome desktop window, bubbles and sparkles",
  sizes: ["standard", "compact"],
  variants: [
    { id: "chrome", name: "Chrome", description: "Brushed silver" },
    { id: "candy", name: "Candy", description: "Pastel iridescent" },
  ],
  defaultVariant: "chrome",
  heroStats: ["globalRank", "countryRank", "level"],
  statRoles: { globalRank: "Chrome headline", countryRank: "Under headline", level: "Progress bar" },
  statSlots: { standard: 4, compact: 3 },
  ground: () => "#c9ced6",
  // Primary is used for the title bar, first pill and blooms; text is chrome ink.
  contrastTarget: null,
  supports: { avatarShape: true, cover: true, effects: true, decorations: true },
  fonts: ["Michroma", "Space Mono"],
  Component: Y2KSvg,
};
