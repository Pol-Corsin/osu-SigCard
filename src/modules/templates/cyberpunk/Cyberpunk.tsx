/**
 * CYBERPUNK — a heads-up display.
 *
 * Cut-corner frame glowing over a perspective grid (or data rain), hexagonal
 * avatar with scanlines, RGB-split glitch name, global rank as a glowing
 * readout, level as discrete segments, and the remaining stats as monospace
 * meters in a side panel.
 */
import type { ReactNode } from "react";
import { ensureContrast, mix } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import type { PlayerStats } from "../../player/types";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText } from "../../render/measure";
import { Avatar, has, pickStats, polygonPoints, r2, seeded } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const DISPLAY = "Chakra Petch" as const;
const MONO = "JetBrains Mono" as const;

const LAYOUT = {
  standard: {
    cut: 24, inset: 16,
    hex: { cx: 114, cy: 150, r: 76 },
    x: 214,
    name: { baseline: 112, max: 52, min: 26 },
    sub: { y: 140, size: 11 },
    rankLabel: { y: 180, size: 10 },
    rank: { baseline: 232, max: 56, min: 34 },
    seg: { y: 250, w: 11, h: 8, gap: 4, count: 20 },
    panel: { x: 604, y: 50, w: 254, h: 200, rowH: 46, label: 9.5, value: 16 },
    horizon: 188,
    side: { size: 8.5 },
  },
  compact: {
    cut: 16, inset: 10,
    hex: { cx: 74, cy: 100, r: 52 },
    x: 142,
    name: { baseline: 70, max: 36, min: 18 },
    sub: { y: 90, size: 8.5 },
    rankLabel: { y: 118, size: 8 },
    rank: { baseline: 156, max: 40, min: 24 },
    seg: { y: 168, w: 8, h: 6, gap: 3, count: 16 },
    panel: { x: 428, y: 30, w: 190, h: 140, rowH: 44, label: 8, value: 13 },
    horizon: 126,
    side: { size: 7 },
  },
};

/** 0–1 meter fill per stat, on scales that make typical players land mid-bar. */
function meter(k: StatKey, s: PlayerStats): number {
  const log = (v: number, max: number) => (v > 0 ? Math.min(1, Math.log10(v) / max) : 0);
  switch (k) {
    case "pp": return Math.min(1, s.pp / 15000);
    case "accuracy": return Math.max(0, Math.min(1, (s.accuracy - 80) / 20));
    case "playCount": return log(s.playCount, 6);
    case "rankedScore": return log(s.rankedScore, 12);
    case "medals": return Math.min(1, s.medals / 350);
    case "level": return Math.min(1, s.level.current / 120);
    case "globalRank": return s.globalRank ? Math.max(0.02, 1 - Math.log10(s.globalRank) / 7) : 0;
    case "countryRank": return s.countryRank ? Math.max(0.02, 1 - Math.log10(s.countryRank) / 6) : 0;
  }
}

function CyberpunkSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const L = LAYOUT[size.id];
  const { width: W, height: H } = size;
  const { appearance: ap, colors } = config;
  const rain = config.variant === "rain";

  const bg = template.ground(config);
  const pc = ensureContrast(colors.primary, bg, 3.5);
  const sc = ensureContrast(colors.secondary, bg, 3.5);
  const text = "#f4f2fb";
  const dim = "#8b87a0";
  const I = L.inset;
  const frame = `${I},${I} ${W - I - L.cut},${I} ${W - I},${I + L.cut} ${W - I},${H - I} ${I + L.cut},${H - I} ${I},${H - I - L.cut}`;
  const hex = polygonPoints(L.hex.cx, L.hex.cy, L.hex.r, 6, -90);
  const rnd = seeded(player.id);

  // ---- identity ----
  const nameMax = L.panel.x - L.x - 24;
  const name = fitText(player.username.toUpperCase(), { family: DISPLAY, weight: 700, maxWidth: nameMax, maxSize: L.name.max, minSize: L.name.min, letterSpacing: 1 });
  const subParts = [`// ${GAME_MODE_LABELS[player.mode].long.toUpperCase()}`];
  if (ap.flag) subParts.push(`// ${player.countryCode}`);
  if (has(config, "countryRank")) subParts.push(`#${player.stats.countryRank?.toLocaleString("en-US") ?? "---"}`);
  const sub = fitText(subParts.join(" "), { family: MONO, weight: 400, maxWidth: nameMax, maxSize: L.sub.size, minSize: L.sub.size * 0.75, letterSpacing: 2 });

  // ---- hero rank ----
  const showRank = has(config, "globalRank");
  const rankStat = formatStat("globalRank", player.stats);
  const rank = fitText(rankStat.empty ? "#------" : rankStat.value, { family: DISPLAY, weight: 700, maxWidth: nameMax, maxSize: L.rank.max, minSize: L.rank.min });

  // ---- level segments ----
  const showLevel = has(config, "level");
  const lit = Math.round((player.stats.level.progress / 100) * L.seg.count);
  const segEnd = L.x + L.seg.count * (L.seg.w + L.seg.gap);

  // ---- HUD panel ----
  const keys = pickStats(config, template.heroStats, template.statSlots[size.id]);
  const P = L.panel;
  const rowH = keys.length ? Math.min(P.rowH, (P.h - 24) / keys.length) : P.rowH;
  const panelH = keys.length ? keys.length * rowH + 20 : 0;
  const panelY = P.y + (P.h - panelH) / 2;

  // ---- background motifs ----
  const motif: ReactNode[] = [];
  if (!rain) {
    for (let i = 0; i <= 22; i++) {
      const t = i - 11;
      motif.push(<line key={`v${i}`} x1={r2(W / 2 + t * (W / 40))} y1={L.horizon} x2={r2(W / 2 + t * (W / 6))} y2={H} />);
    }
    [0.04, 0.12, 0.25, 0.45, 0.72].forEach((f, i) => {
      const y = r2(L.horizon + (H - L.horizon) * f);
      motif.push(<line key={`h${i}`} x1={0} y1={y} x2={W} y2={y} />);
    });
  } else {
    const cols = Math.floor(W / 18);
    for (let c = 0; c < cols; c++) {
      const len = 3 + Math.floor(rnd() * 9);
      const y0 = Math.floor(rnd() * H);
      const chars = Array.from({ length: len }, () => "0123456789ABCDEF"[Math.floor(rnd() * 16)]).join("");
      motif.push(
        <text key={`r${c}`} x={c * 18 + 4} y={y0} fontFamily={MONO} fontSize={8} fill={sc} fillOpacity={0.05 + rnd() * 0.09} transform={`rotate(90 ${c * 18 + 4} ${y0})`}>
          {chars}
        </text>,
      );
    }
  }

  // ---- barcode from player id ----
  const bars: ReactNode[] = [];
  if (ap.decorations) {
    let bx = 0;
    const br = seeded(player.id * 7 + 1);
    while (bx < (size.id === "standard" ? 70 : 46)) {
      const w = 1 + Math.floor(br() * 3);
      if (br() > 0.35) bars.push(<rect key={bx} x={W - I - 16 - bx} y={H - I - 22} width={w} height={size.id === "standard" ? 10 : 7} fill={dim} />);
      bx += w + 1;
    }
  }

  const coverOn = ap.cover && !!assets.cover;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <filter id={`${id}-glow`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation={3.2} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-mono`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id={`${id}-scan`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.4" fill="#000" fillOpacity={0.45} />
        </pattern>
        <pattern id={`${id}-scanall`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="#000" fillOpacity={0.22} />
        </pattern>
        <clipPath id={`${id}-frame`}>
          <polygon points={frame} />
        </clipPath>
        <radialGradient id={`${id}-vignette`} cx="0.3" cy="0.45" r="0.85">
          <stop offset="0" stopColor={colors.primary} stopOpacity={0.2} />
          <stop offset="1" stopColor={colors.primary} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-coverfade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg} stopOpacity={0.55} />
          <stop offset="1" stopColor={bg} stopOpacity={0.95} />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill={bg} />
      {coverOn && (
        <g clipPath={`url(#${id}-frame)`}>
          <image href={assets.cover!} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-mono)`} opacity={0.3} />
          <rect width={W} height={H} fill={colors.primary} fillOpacity={0.12} />
          <rect width={W} height={H} fill={`url(#${id}-coverfade)`} />
        </g>
      )}
      {ap.effects && <rect width={W} height={H} fill={`url(#${id}-vignette)`} />}
      <g clipPath={`url(#${id}-frame)`} stroke={sc} strokeOpacity={0.2} strokeWidth={1}>
        {motif}
      </g>

      {/* frame */}
      <polygon points={frame} fill="none" stroke={pc} strokeWidth={1.5} filter={ap.effects ? `url(#${id}-glow)` : undefined} />
      {ap.decorations && (
        <path d={`M${I} ${I + 54}V${I}H${I + 54}M${W - I - 54} ${H - I}H${W - I}V${H - I - 54}`} fill="none" stroke={sc} strokeWidth={3} />
      )}

      {/* hex avatar */}
      {ap.avatar ? (
        <Avatar
          id={`${id}-av`}
          x={L.hex.cx - L.hex.r}
          y={L.hex.cy - L.hex.r}
          w={L.hex.r * 2}
          h={L.hex.r * 2}
          polygon={hex}
          href={assets.avatar}
          username={player.username}
          colors={{ a: colors.primary, b: colors.secondary }}
          monogramFont={{ family: DISPLAY, weight: 700 }}
        />
      ) : (
        <polygon points={hex} fill={mix(colors.primary, bg, 0.75)} />
      )}
      {ap.effects && <polygon points={hex} fill={`url(#${id}-scan)`} />}
      <polygon points={hex} fill="none" stroke={pc} strokeWidth={2} filter={ap.effects ? `url(#${id}-glow)` : undefined} />

      {/* glitch name */}
      <text x={L.x + 3} y={L.name.baseline} fontFamily={DISPLAY} fontWeight={700} fontSize={name.size} letterSpacing={1} fill={sc} fillOpacity={0.85}>
        {name.text}
      </text>
      <text x={L.x - 3} y={L.name.baseline} fontFamily={DISPLAY} fontWeight={700} fontSize={name.size} letterSpacing={1} fill={pc} fillOpacity={0.85}>
        {name.text}
      </text>
      <text x={L.x} y={L.name.baseline} fontFamily={DISPLAY} fontWeight={700} fontSize={name.size} letterSpacing={1} fill={text}>
        {name.text}
      </text>
      <text x={L.x + 2} y={L.sub.y} fontFamily={MONO} fontWeight={400} fontSize={sub.size} letterSpacing={2} fill={sc}>
        {sub.text}
      </text>

      {/* rank readout */}
      {showRank && (
        <g>
          <text x={L.x + 2} y={L.rankLabel.y} fontFamily={MONO} fontWeight={400} fontSize={L.rankLabel.size} letterSpacing={2} fill={dim}>
            GLOBAL_RANK
          </text>
          <text x={L.x - 2} y={L.rank.baseline} fontFamily={DISPLAY} fontWeight={700} fontSize={rank.size} fill={rankStat.empty ? dim : pc} filter={ap.effects ? `url(#${id}-glow)` : undefined}>
            {rank.text}
          </text>
        </g>
      )}

      {/* level segments */}
      {showLevel && (
        <g>
          {Array.from({ length: L.seg.count }, (_, i) => (
            <rect key={i} x={L.x + i * (L.seg.w + L.seg.gap)} y={L.seg.y} width={L.seg.w} height={L.seg.h} fill={i < lit ? pc : "#ffffff"} fillOpacity={i < lit ? 1 : 0.12} />
          ))}
          <text x={segEnd + 8} y={L.seg.y + L.seg.h} fontFamily={MONO} fontWeight={400} fontSize={L.rankLabel.size + 1} fill={text}>
            {`LV.${player.stats.level.current}`}
          </text>
        </g>
      )}

      {/* HUD panel */}
      {keys.length > 0 && (
        <g>
          <rect x={P.x} y={r2(panelY)} width={P.w} height={r2(panelH)} fill="#ffffff" fillOpacity={0.03} stroke={sc} strokeOpacity={0.35} />
          {keys.map((k, i) => {
            const s = formatStat(k, player.stats);
            const y = panelY + 14 + i * rowH + rowH * 0.42;
            const v = fitText(`${s.value}${s.unit ?? ""}`, { family: MONO, weight: 700, maxWidth: P.w * 0.55, maxSize: P.value, minSize: P.value * 0.7 });
            const lbl = STAT_LABELS[k].label.toUpperCase().replace(/ /g, "_");
            return (
              <g key={k}>
                <text x={P.x + 16} y={r2(y)} fontFamily={MONO} fontWeight={400} fontSize={P.label} letterSpacing={1.5} fill={sc}>
                  {lbl}
                </text>
                <text x={P.x + P.w - 16} y={r2(y)} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={v.size} fill={s.empty ? dim : text}>
                  {v.text}
                </text>
                <rect x={P.x + 16} y={r2(y + 9)} width={P.w - 32} height={3} fill="#ffffff" fillOpacity={0.1} />
                <rect x={P.x + 16} y={r2(y + 9)} width={r2((P.w - 32) * meter(k, player.stats))} height={3} fill={pc} />
              </g>
            );
          })}
        </g>
      )}

      {ap.decorations && (
        <g>
          <text transform={`translate(${W - I + 4 + L.side.size * 0.3} ${H / 2}) rotate(90)`} textAnchor="middle" fontFamily={MONO} fontSize={L.side.size} letterSpacing={3} fill={sc} fillOpacity={0.7}>
            {`ID:${player.id.toString(16).toUpperCase().padStart(8, "0")}`}
          </text>
          {bars}
        </g>
      )}

      {ap.effects && <rect width={W} height={H} fill={`url(#${id}-scanall)`} clipPath={`url(#${id}-frame)`} opacity={0.5} />}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "cyberpunk",
  version: 1,
  name: "Cyberpunk",
  tagline: "Neon HUD with glitch type and meters",
  sizes: ["standard", "compact"],
  variants: [
    { id: "grid", name: "Grid", description: "Perspective grid floor" },
    { id: "rain", name: "Data rain", description: "Falling hex streams seeded by player id" },
  ],
  defaultVariant: "grid",
  heroStats: ["globalRank", "countryRank", "level"],
  statRoles: { globalRank: "Readout", countryRank: "Status line", level: "Segment bar" },
  statSlots: { standard: 4, compact: 3 },
  ground: (config) => mix("#07060c", config.colors.secondary, 0.03),
  contrastTarget: 3.5,
  supports: { avatarShape: false, cover: true, effects: true, decorations: true },
  fonts: ["Chakra Petch", "JetBrains Mono"],
  Component: CyberpunkSvg,
};
