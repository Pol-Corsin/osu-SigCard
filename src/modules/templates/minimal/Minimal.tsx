/**
 * MINIMAL — restraint as the design.
 * Identity on the left like a byline, one thin oversized rank numeral on the
 * right, the remaining stats on a single baseline split by hairlines, level as
 * a 2px progress rule. Primary color appears only on the rank and the rule.
 */
import { ensureContrast, mix } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Avatar, Flag, has, pickStats } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const FONT = "Hanken Grotesk" as const;

const LAYOUT = {
  standard: {
    m: 56, top: 52, avatar: 74,
    name: { baseline: 92, max: 40, min: 24 },
    meta: { y: 118, size: 11, flagW: 18 },
    hero: { labelY: 62, baseline: 148, max: 92, min: 56, sub: 14, subY: 178, maxWidth: 380 },
    stats: { labelY: 222, valueY: 254, label: 10.5, value: 25, unit: 14, minCol: 150, sepTop: 206, sepBottom: 260 },
    rule: { y: 282, label: 10 },
    crop: 18,
  },
  compact: {
    m: 36, top: 32, avatar: 52,
    name: { baseline: 62, max: 30, min: 18 },
    meta: { y: 84, size: 9, flagW: 14 },
    hero: { labelY: 40, baseline: 98, max: 62, min: 38, sub: 11, subY: 120, maxWidth: 250 },
    stats: { labelY: 146, valueY: 170, label: 8.5, value: 19, unit: 11, minCol: 110, sepTop: 134, sepBottom: 176 },
    rule: { y: 186, label: 8 },
    crop: 12,
  },
};

function MinimalSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const L = LAYOUT[size.id];
  const { width: W, height: H } = size;
  const { appearance: ap, colors } = config;
  const dark = config.variant === "ink";

  const bg = template.ground(config);
  const ink = dark ? "#f1f0f5" : "#17161c";
  const mute = dark ? "#9a97a6" : "#6b6874";
  const hair = mix(ink, bg, 0.84);
  const pr = ensureContrast(colors.primary, bg, 3.2);
  const right = W - L.m;

  // ---- hero: global rank, else country rank ----
  const heroKey: StatKey | null = has(config, "globalRank") ? "globalRank" : has(config, "countryRank") ? "countryRank" : null;
  const hero = heroKey ? formatStat(heroKey, player.stats) : null;
  const heroFit = hero
    ? fitText(hero.value, { family: FONT, weight: 200, maxWidth: L.hero.maxWidth, maxSize: L.hero.max, minSize: L.hero.min, trackingEm: -0.035 })
    : null;
  const heroLabel = heroKey === "countryRank" ? `COUNTRY RANK · ${player.countryName.toUpperCase()}` : "GLOBAL RANK";
  const showSub = heroKey === "globalRank" && has(config, "countryRank");
  const sub = player.stats.countryRank == null ? `Unranked in ${player.countryName}` : `#${player.stats.countryRank.toLocaleString("en-US")} in ${player.countryName}`;

  // ---- identity ----
  const showAvatar = ap.avatar;
  const nameX = showAvatar ? L.m + L.avatar + 24 : L.m;
  const nameMax = right - nameX - (heroFit ? heroFit.width + 40 : 0);
  const name = fitText(player.username, { family: FONT, weight: 500, maxWidth: nameMax, maxSize: L.name.max, minSize: L.name.min, trackingEm: -0.025 });
  const showFlag = ap.flag && !!assets.flag;
  const metaX = nameX + (showFlag ? L.meta.flagW + 9 : 0);
  const metaText = `${GAME_MODE_LABELS[player.mode].long}  ·  ${player.countryName}`;
  const meta = fitText(metaText, { family: FONT, weight: 500, maxWidth: nameMax - (metaX - nameX), maxSize: L.meta.size + 2, minSize: L.meta.size, letterSpacing: 0.4 });

  // ---- stats row ----
  const keys = pickStats(config, ["globalRank", "countryRank", "level"], template.statSlots[size.id]);
  const colW = Math.max(L.stats.minCol, (right - L.m) / Math.max(keys.length, 4));
  const showLevel = has(config, "level");

  const accent = ap.effects ? mix(colors.primary, bg, 0.9) : bg;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <radialGradient id={`${id}-wash`} cx="1" cy="0" r="1">
          <stop offset="0" stopColor={accent} stopOpacity={dark ? 0.9 : 1} />
          <stop offset="0.7" stopColor={bg} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={bg} />
      {ap.effects && <rect width={W} height={H} fill={`url(#${id}-wash)`} />}

      {ap.decorations && (
        <g stroke={hair} strokeWidth={1}>
          {[
            [L.crop, L.crop, 1, 1],
            [W - L.crop, L.crop, -1, 1],
            [L.crop, H - L.crop, 1, -1],
            [W - L.crop, H - L.crop, -1, -1],
          ].map(([x, y, dx, dy], i) => (
            <path key={i} d={`M${x} ${y + dy * 8}V${y}H${x + dx * 8}`} fill="none" />
          ))}
        </g>
      )}

      {showAvatar && (
        <Avatar
          id={`${id}-av`}
          x={L.m}
          y={L.top}
          w={L.avatar}
          h={L.avatar}
          href={assets.avatar}
          username={player.username}
          shape={ap.avatarShape === "round" ? "round" : { rx: 0 }}
          colors={{ a: colors.primary, b: colors.secondary }}
          monogramFont={{ family: FONT, weight: 400 }}
        />
      )}

      <text x={nameX - 1} y={L.name.baseline} fontFamily={FONT} fontWeight={500} fontSize={name.size} letterSpacing={name.letterSpacing} fill={ink}>
        {name.text}
      </text>
      {showFlag && <Flag href={assets.flag} x={nameX} y={L.meta.y - L.meta.size * 0.82 - 1} w={L.meta.flagW} rx={1.5} />}
      <text x={metaX} y={L.meta.y} fontFamily={FONT} fontWeight={500} fontSize={meta.size} letterSpacing={0.4} fill={mute}>
        {meta.text}
      </text>

      {hero && heroFit && (
        <g>
          <text x={right} y={L.hero.labelY} textAnchor="end" fontFamily={FONT} fontWeight={500} fontSize={L.stats.label} letterSpacing={2.4} fill={mute}>
            {heroLabel}
          </text>
          <text x={right + heroFit.size * 0.04} y={L.hero.baseline} textAnchor="end" fontFamily={FONT} fontWeight={200} fontSize={heroFit.size} letterSpacing={heroFit.letterSpacing} fill={hero.empty ? mute : pr}>
            {heroFit.text}
          </text>
          {showSub && (
            <text x={right} y={L.hero.subY} textAnchor="end" fontFamily={FONT} fontWeight={400} fontSize={L.hero.sub} fill={mute}>
              {sub}
            </text>
          )}
        </g>
      )}

      {keys.map((key, i) => {
        const st = formatStat(key, player.stats);
        const x = L.m + i * colW;
        const unitW = st.unit ? measureText(st.unit, { family: FONT, weight: 400, size: L.stats.unit }) + 2 : 0;
        const v = fitText(st.value, { family: FONT, weight: 400, maxWidth: colW - 30 - unitW, maxSize: L.stats.value, minSize: L.stats.value * 0.7, trackingEm: -0.01 });
        return (
          <g key={key}>
            {i > 0 && <line x1={x - 24} y1={L.stats.sepTop} x2={x - 24} y2={L.stats.sepBottom} stroke={hair} />}
            <text x={x} y={L.stats.labelY} fontFamily={FONT} fontWeight={500} fontSize={L.stats.label} letterSpacing={1.8} fill={mute}>
              {STAT_LABELS[key].label.toUpperCase()}
            </text>
            <text x={x - 1} y={L.stats.valueY} fontFamily={FONT} fontWeight={400} fontSize={v.size} letterSpacing={v.letterSpacing} fill={st.empty ? mute : ink}>
              {v.text}
              {st.unit && (
                <tspan fontSize={L.stats.unit} fill={mute} dx={2}>
                  {st.unit}
                </tspan>
              )}
            </text>
          </g>
        );
      })}

      {showLevel && (
        <g>
          <line x1={L.m} y1={L.rule.y} x2={right} y2={L.rule.y} stroke={hair} strokeWidth={2} />
          <line x1={L.m} y1={L.rule.y} x2={L.m + ((right - L.m) * player.stats.level.progress) / 100} y2={L.rule.y} stroke={pr} strokeWidth={2} />
          <text x={right} y={L.rule.y - 8} textAnchor="end" fontFamily={FONT} fontWeight={500} fontSize={L.rule.label} letterSpacing={1.8} fill={mute}>
            {`LV ${player.stats.level.current} · ${player.stats.level.progress}%`}
          </text>
        </g>
      )}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "minimal",
  version: 1,
  name: "Minimal",
  tagline: "Quiet typography, one thin hero number",
  sizes: ["standard", "compact"],
  variants: [
    { id: "paper", name: "Paper", description: "Light ground tinted by the secondary color" },
    { id: "ink", name: "Ink", description: "Dark ground, same composition" },
  ],
  defaultVariant: "paper",
  heroStats: ["globalRank", "countryRank", "level"],
  statRoles: { globalRank: "Headline", countryRank: "Under headline", level: "Progress rule" },
  ground: (config) =>
    config.variant === "ink" ? mix(config.colors.secondary, "#0e0e12", 0.9) : mix(config.colors.secondary, "#f8f8f6", 0.9),
  contrastTarget: 3.2,
  statSlots: { standard: 5, compact: 4 },
  supports: { avatarShape: true, cover: false, effects: true, decorations: true },
  fonts: ["Hanken Grotesk"],
  Component: MinimalSvg,
};
