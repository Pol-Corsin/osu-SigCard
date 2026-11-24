/**
 * ARTISTIC — an experimental print.
 *
 * Oversized italic username over blurred colour fields and film grain. The
 * avatar sits at the centre of osu!-style approach circles, and the stats are
 * set on a circular path around it, read by turning the eye around the ring.
 * With a cover image enabled, the colour fields are sampled from the cover.
 */
import { mix } from "../../color/color";
import { formatStat, STAT_LABELS } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { accentOf, Avatar, Flag, has, pickStats, r2 } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const SERIF = "Fraunces" as const;
const MONO = "JetBrains Mono" as const;

const LAYOUT = {
  standard: {
    ring: { cx: 706, cy: 150, avatar: 64, rings: [86, 120, 152, 190], text: 101, textSize: 10.5 },
    name: { x: 22, baseline: 194, max: 176, min: 66, maxWidth: 600 },
    label: { x: 32, y: 42, size: 10.5, flagW: 16 },
    rank: { x: 32, baseline: 262, size: 38, mono: 10.5 },
    blobs: { blur: 46 },
    line: [0, 226, 900, 172],
  },
  compact: {
    ring: { cx: 512, cy: 100, avatar: 42, rings: [57, 80, 102, 128], text: 67, textSize: 8.5 },
    name: { x: 14, baseline: 126, max: 116, min: 44, maxWidth: 420 },
    label: { x: 22, y: 28, size: 8.5, flagW: 12 },
    rank: { x: 22, baseline: 176, size: 26, mono: 8.5 },
    blobs: { blur: 32 },
    line: [0, 150, 640, 114],
  },
};

function ArtisticSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const L = LAYOUT[size.id];
  const { width: W, height: H } = size;
  const { appearance: ap, colors } = config;
  const paperVariant = config.variant === "paper";

  const ground = template.ground(config);
  const ink = paperVariant ? "#17151b" : "#f6f1ea";
  const accent = accentOf(config);
  const R = L.ring;

  // ---- name: oversized italic ----
  const name = fitText(player.username, {
    family: SERIF, weight: 800, style: "italic", maxWidth: Math.min(L.name.maxWidth, R.cx - R.rings[0] - 36 - L.name.x), maxSize: L.name.max, minSize: L.name.min, trackingEm: -0.035,
  });

  // ---- ring text: enabled stats joined, repeated and tracked to fill the circle exactly ----
  const keys = pickStats(config, template.heroStats, template.statSlots[size.id]);
  const parts = keys.map((k) => {
    const s = formatStat(k, player.stats);
    return `${s.value}${s.unit === "%" ? "%" : ""} ${STAT_LABELS[k].short.toUpperCase()}`;
  });
  const circumference = 2 * Math.PI * R.text;
  let ring = "";
  let ringLetterSpacing = 0;
  let ringSize = R.textSize;
  if (parts.length) {
    // Pick the repetition count and size that fill the circle with ~1.5px tracking,
    // keeping the type between 85% and 125% of its nominal size.
    const unit = parts.join("  ·  ") + "  ·  ";
    const at = (reps: number, size: number) => measureText(unit.repeat(reps), { family: MONO, weight: 400, size });
    let reps = 1;
    for (; reps < 6; reps++) {
      const chars = Array.from(unit).length * reps;
      const fitSize = (R.textSize * (circumference - chars * 1.5)) / at(reps, R.textSize);
      if (fitSize <= R.textSize * 1.25) break;
    }
    const chars = Array.from(unit).length * reps;
    ringSize = r2(Math.max(R.textSize * 0.85, Math.min(R.textSize * 1.25, (R.textSize * (circumference - chars * 1.5)) / at(reps, R.textSize))));
    ring = unit.repeat(reps);
    ringLetterSpacing = r2((circumference - at(reps, ringSize)) / chars);
  }

  // ---- rank line ----
  const showRank = has(config, "globalRank");
  const showCountry = has(config, "countryRank");
  const rank = player.stats.globalRank;
  const rankText = rank == null ? "unranked" : `№ ${rank.toLocaleString("en-US")}`;
  const rankW = showRank ? measureText(rankText, { family: SERIF, weight: 300, style: "italic", size: L.rank.size }) : 0;
  const countryText = showCountry
    ? `${showRank ? "GLOBAL  /  " : ""}${player.stats.countryRank ? "#" + player.stats.countryRank.toLocaleString("en-US") : "UNRANKED"} ${player.countryName.toUpperCase()}`
    : showRank
      ? "GLOBAL"
      : "";

  const label = fitText(`${GAME_MODE_LABELS[player.mode].long.toUpperCase()} — ${player.countryName.toUpperCase()}`, {
    family: MONO, weight: 400, maxWidth: R.cx - R.rings[2] - L.label.x - 40, maxSize: L.label.size, minSize: L.label.size * 0.8, letterSpacing: 2.6,
  });
  const showFlag = ap.flag && !!assets.flag;
  const coverOn = ap.cover && !!assets.cover;
  const [lx1, ly1, lx2, ly2] = L.line;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={L.blobs.blur} />
        </filter>
        <filter id={`${id}-coverblur`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={L.blobs.blur * 0.7} />
          <feColorMatrix type="saturate" values="1.4" />
        </filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues={paperVariant ? "0 0.22" : "0 0.3"} />
          </feComponentTransfer>
        </filter>
        <path id={`${id}-ring`} d={`M${R.cx} ${R.cy - R.text}a${R.text} ${R.text} 0 1 1 0 ${R.text * 2}a${R.text} ${R.text} 0 1 1 0 ${-R.text * 2}`} />
      </defs>

      <rect width={W} height={H} fill={ground} />

      {/* colour fields */}
      {coverOn ? (
        <g opacity={paperVariant ? 0.55 : 0.75}>
          <image href={assets.cover!} x={-W * 0.1} y={-H * 0.1} width={W * 1.2} height={H * 1.2} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-coverblur)`} />
        </g>
      ) : null}
      <g filter={`url(#${id}-blur)`} opacity={coverOn ? 0.55 : 1}>
        <circle cx={W * 0.23} cy={H * 0.3} r={H * 0.44} fill={colors.primary} fillOpacity={paperVariant ? 0.55 : 0.85} />
        <circle cx={W * 0.58} cy={H * 0.92} r={H * 0.5} fill={colors.secondary} fillOpacity={paperVariant ? 0.5 : 0.72} />
        <ellipse cx={W * 0.93} cy={H * 0.12} rx={H * 0.5} ry={H * 0.3} fill={accent} fillOpacity={paperVariant ? 0.45 : 0.58} />
      </g>

      {ap.decorations && <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={ink} strokeOpacity={0.22} />}

      {/* approach circles */}
      {R.rings.map((r, i) => (
        <circle key={r} cx={R.cx} cy={R.cy} r={r} fill="none" stroke={ink} strokeOpacity={[0.6, 0.34, 0.19, 0.1][i]} strokeWidth={i === 0 ? 1.6 : 1} />
      ))}
      {ap.avatar ? (
        <Avatar
          id={`${id}-av`}
          x={R.cx - R.avatar}
          y={R.cy - R.avatar}
          w={R.avatar * 2}
          h={R.avatar * 2}
          shape="round"
          href={assets.avatar}
          username={player.username}
          colors={{ a: colors.primary, b: colors.secondary }}
          monogramFont={{ family: SERIF, weight: 800 }}
        />
      ) : (
        <circle cx={R.cx} cy={R.cy} r={R.avatar} fill={ink} fillOpacity={0.9} />
      )}
      {ring && (
        <text fontFamily={MONO} fontWeight={400} fontSize={ringSize} letterSpacing={ringLetterSpacing} fill={ink} fillOpacity={0.92}>
          <textPath href={`#${id}-ring`}>{ring}</textPath>
        </text>
      )}

      {/* top label */}
      {showFlag && <Flag href={assets.flag} x={L.label.x} y={L.label.y - L.label.size * 0.95} w={L.label.flagW} rx={1} />}
      <text x={L.label.x + (showFlag ? L.label.flagW + 10 : 0)} y={L.label.y} fontFamily={MONO} fontWeight={400} fontSize={label.size} letterSpacing={2.6} fill={ink} fillOpacity={0.75}>
        {label.text}
      </text>

      {/* the name */}
      <text x={L.name.x} y={L.name.baseline} fontFamily={SERIF} fontStyle="italic" fontWeight={800} fontSize={name.size} letterSpacing={name.letterSpacing} fill={ink}>
        {name.text}
      </text>

      {/* rank line */}
      {showRank && (
        <text x={L.rank.x} y={L.rank.baseline} fontFamily={SERIF} fontStyle="italic" fontWeight={300} fontSize={L.rank.size} fill={ink}>
          {rankText}
        </text>
      )}
      {countryText && (
        <text x={L.rank.x + (showRank ? rankW + L.rank.size * 0.45 : 0)} y={L.rank.baseline - L.rank.size * 0.12} fontFamily={MONO} fontWeight={400} fontSize={L.rank.mono} letterSpacing={2} fill={ink} fillOpacity={0.75}>
          {countryText}
        </text>
      )}

      {ap.effects && <rect width={W} height={H} filter={`url(#${id}-grain)`} />}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "artistic",
  version: 1,
  name: "Artistic",
  tagline: "Italic type, colour fields, approach circles",
  sizes: ["standard", "compact"],
  variants: [
    { id: "dusk", name: "Dusk", description: "Dark ground, glowing colour fields" },
    { id: "paper", name: "Paper", description: "Light ground, softer colour fields" },
  ],
  defaultVariant: "dusk",
  heroStats: ["globalRank", "countryRank"],
  statRoles: { globalRank: "Rank line", countryRank: "Rank line" },
  statSlots: { standard: 6, compact: 4 },
  ground: (config) => (config.variant === "paper" ? mix("#ecebe6", config.colors.secondary, 0.05) : mix("#131116", config.colors.primary, 0.04)),
  // Colours are used for fields and shapes; all text is ink.
  contrastTarget: null,
  supports: { avatarShape: false, cover: true, effects: true, decorations: true },
  fonts: ["Fraunces", "JetBrains Mono"],
  Component: ArtisticSvg,
};
