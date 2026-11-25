/**
 * MINIMAL ("Identity") — a premium digital ID document.
 * A portrait panel tinted by the player's own avatar, a precise level arc,
 * an extra-light rank numeral with the # in the primary colour, a hairline
 * ledger, and a passport-style machine-readable line along the bottom edge.
 * The primary colour appears only on the arc, its end dot and the #.
 */
import { ensureContrast, mix } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Avatar, Flag, has, pickStats, r2, rightEdgeX } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const SANS = "Hanken Grotesk" as const;
const MONO = "JetBrains Mono" as const;

const THEMES = {
  paper: { ground: "#F4F3EF", panel: "#EBE9E3", ink: "#141414", sheen: 0.5 },
  graphite: { ground: "#101012", panel: "#17171A", ink: "#F3F2EE", sheen: 0.05 },
} as const;
type ThemeId = keyof typeof THEMES;

const theme = (variant: string | null): (typeof THEMES)[ThemeId] => THEMES[(variant as ThemeId) in THEMES ? (variant as ThemeId) : "paper"];

/** Keys that never go in the ledger: they have dedicated places. */
const PLACED: StatKey[] = ["globalRank", "countryRank", "level"];

function MinimalSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const { width: W, height: H } = size;
  const k = H / 300; // compact (200px) is the standard layout scaled to 2/3, anchored to the right edge
  const t = theme(config.variant);
  const { appearance: ap, colors } = config;
  const s = player.stats;
  const ink = t.ink;
  const soft = mix(ink, t.ground, 0.45);
  const hair = mix(ink, t.ground, 0.86);
  const mrzInk = mix(ink, t.ground, 0.75);
  const accent = ensureContrast(colors.primary, t.ground, 3);
  const arcColor = ensureContrast(colors.primary, t.panel, 2.2);

  // ------------------------------------------------------------ portrait
  const PANEL = Math.round(296 * k);
  const cx = Math.round(150 * k);
  const cy = Math.round(142 * k);
  const R = 74 * k;
  const ring = R + 13 * k;
  const round = ap.avatarShape === "round";
  const showLevel = has(config, "level");
  const prog = Math.min(1, Math.max(0.02, s.level.progress / 100));
  const a0 = -Math.PI / 2;
  const a1 = a0 + prog * Math.PI * 2;
  const arcEnd = { x: cx + ring * Math.cos(a1), y: cy + ring * Math.sin(a1) };
  const arcPath = `M${r2(cx)} ${r2(cy - ring)}A${r2(ring)} ${r2(ring)} 0 ${prog > 0.5 ? 1 : 0} 1 ${r2(arcEnd.x)} ${r2(arcEnd.y)}`;
  const levelLabel = `LEVEL ${s.level.current} · ${s.level.progress}%`;

  // ---------------------------------------------------------- text column
  const X = PANEL + Math.round(34 * k);
  const RIGHT = W - Math.round(40 * k);
  // Small labels never drop below 7px, so the compact card stays readable.
  const px = (size: number) => r2(Math.max(7, size * k));
  const label = (size: number) => ({ fontFamily: MONO, fontWeight: 400, fontSize: px(size), letterSpacing: r2(px(size) * 0.16) });

  const name = fitText(player.username, { family: SANS, weight: 600, maxWidth: RIGHT - X, maxSize: 54 * k, minSize: 26 * k, trackingEm: -0.035 });

  // Hero: global rank, else country rank, else the first ledger stat.
  const regular = pickStats(config, PLACED, 99);
  const heroKey: StatKey | null = has(config, "globalRank") ? "globalRank" : has(config, "countryRank") ? "countryRank" : (regular[0] ?? null);
  const hero = heroKey ? formatStat(heroKey, s) : null;
  const isRank = heroKey === "globalRank" || heroKey === "countryRank";
  const heroText = hero ? (hero.empty ? "Unranked" : isRank ? hero.value.replace(/^#/, "") : hero.value) : "";
  const heroLabel =
    heroKey === "globalRank" ? "GLOBAL RANK" : heroKey === "countryRank" ? `COUNTRY RANK · ${player.countryCode}` : heroKey ? STAT_LABELS[heroKey].label.toUpperCase() : "";

  const ledgerKeys = pickStats(config, [...PLACED, ...(isRank ? [] : heroKey ? [heroKey] : [])], template.statSlots[size.id]);
  const LX = RIGHT - Math.round(184 * k);
  const heroRight = ledgerKeys.length ? LX - 24 * k : RIGHT;
  const hashSize = 40 * k;
  const hashW = isRank && !hero?.empty ? hashSize * 0.62 : 0;
  const heroFit = fitText(heroText, { family: SANS, weight: 200, maxWidth: heroRight - X - hashW, maxSize: 100 * k, minSize: 52 * k, trackingEm: -0.045 });
  const unitSize = heroFit.size * 0.24;

  // Identity line: country, plus national rank when it isn't the hero.
  const showFlag = ap.flag && !!assets.flag;
  const flagW = 18 * k;
  const nationally =
    heroKey !== "countryRank" && has(config, "countryRank")
      ? s.countryRank == null
        ? `  ·  unranked nationally`
        : `  ·  #${s.countryRank.toLocaleString("en-US")} nationally`
      : "";
  const idX = X + (showFlag ? flagW + 8 * k : 0);
  const idLine = fitText(`${player.countryName}${nationally}`, { family: SANS, weight: 400, maxWidth: RIGHT - idX, maxSize: 13.5 * k, minSize: 10 * k });

  // Ledger rows: spread between the top rule and the bottom of the rank block.
  const ledgerTop = 154 * k;
  const ledgerBottom = 262 * k;
  const rowH = ledgerKeys.length ? (ledgerBottom - ledgerTop) / Math.max(3, ledgerKeys.length) : 0;
  const valueSize = Math.min(16, 13 + (4 - ledgerKeys.length)) * k;

  // Machine-readable zone: fills the text column with "<".
  const mrzSize = 9.6 * k;
  const mrzSpacing = mrzSize * 0.08;
  const mrzChar = measureText("<", { family: MONO, weight: 400, size: mrzSize, letterSpacing: mrzSpacing });
  const mrzLen = Math.max(10, Math.floor((RIGHT - X) / mrzChar));
  const mrzName = player.username.toUpperCase().replace(/[^A-Z0-9]/g, "<");
  const mrz = `P<${player.countryCode}${mrzName}<<${s.globalRank ?? 0}<${Math.round(s.pp)}<${s.accuracy.toFixed(2).replace(".", "")}<${player.mode.toUpperCase()}`
    .padEnd(mrzLen, "<")
    .slice(0, mrzLen);

  const monoColors = { a: colors.primary, b: colors.secondary };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <clipPath id={`${id}-panel`}>
          <rect width={PANEL} height={H} />
        </clipPath>
        <filter id={`${id}-tint`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={r2(38 * k)} />
        </filter>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={t.sheen} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(colors.secondary, t.panel, 0.82)} />
          <stop offset="1" stopColor={mix(colors.primary, t.panel, 0.88)} />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill={t.ground} />
      {ap.effects && <rect width={W} height={H} fill={`url(#${id}-sheen)`} />}

      {/* portrait panel, tinted by a blurred copy of the avatar (or the card colours) */}
      <rect width={PANEL} height={H} fill={t.panel} />
      {ap.effects &&
        (ap.avatar && assets.avatar ? (
          <g clipPath={`url(#${id}-panel)`}>
            <image href={assets.avatar} x={r2(-40 * k)} y={r2(-80 * k)} width={r2(380 * k)} height={r2(460 * k)} preserveAspectRatio="xMidYMid slice" filter={`url(#${id}-tint)`} opacity={config.variant === "graphite" ? 0.35 : 0.3} />
            <rect width={PANEL} height={H} fill={t.panel} fillOpacity={0.35} />
          </g>
        ) : (
          <rect width={PANEL} height={H} fill={`url(#${id}-wash)`} />
        ))}

      {/* level: arc around a round portrait, a rule under a square one */}
      {round ? (
        <g>
          <circle cx={cx} cy={cy} r={r2(ring)} fill="none" stroke={hair} strokeWidth={1} />
          {showLevel && (
            <>
              <path d={arcPath} fill="none" stroke={arcColor} strokeWidth={r2(2.25 * k)} strokeLinecap="round" />
              <circle cx={r2(arcEnd.x)} cy={r2(arcEnd.y)} r={r2(3.5 * k)} fill={arcColor} />
            </>
          )}
          {ap.decorations &&
            [0, 1, 2, 3].map((q) => {
              const a = a0 + (q * Math.PI) / 2;
              return (
                <line
                  key={q}
                  x1={r2(cx + (ring + 5 * k) * Math.cos(a))}
                  y1={r2(cy + (ring + 5 * k) * Math.sin(a))}
                  x2={r2(cx + (ring + 9 * k) * Math.cos(a))}
                  y2={r2(cy + (ring + 9 * k) * Math.sin(a))}
                  stroke={ink}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              );
            })}
        </g>
      ) : (
        <g>
          {ap.decorations &&
            [
              [cx - ring, cy - ring, 1, 1],
              [cx + ring, cy - ring, -1, 1],
              [cx - ring, cy + ring, 1, -1],
              [cx + ring, cy + ring, -1, -1],
            ].map(([x, y, dx, dy], i) => (
              <path key={i} d={`M${r2(x)} ${r2(y + dy * 9 * k)}V${r2(y)}H${r2(x + dx * 9 * k)}`} fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={1} />
            ))}
          {showLevel && (
            <>
              <line x1={r2(cx - R)} y1={r2(cy + R + 12 * k)} x2={r2(cx + R)} y2={r2(cy + R + 12 * k)} stroke={hair} strokeWidth={r2(2 * k)} />
              <line x1={r2(cx - R)} y1={r2(cy + R + 12 * k)} x2={r2(cx - R + 2 * R * prog)} y2={r2(cy + R + 12 * k)} stroke={arcColor} strokeWidth={r2(2 * k)} />
            </>
          )}
        </g>
      )}
      {ap.avatar ? (
        <Avatar
          id={`${id}-av`}
          x={r2(cx - R)}
          y={r2(cy - R)}
          w={r2(R * 2)}
          h={r2(R * 2)}
          href={assets.avatar}
          username={player.username}
          colors={monoColors}
          shape={round ? "round" : { rx: 4 * k }}
          monogramFont={{ family: SANS, weight: 300 }}
        />
      ) : (
        <text x={cx} y={r2(cy + 26 * k)} textAnchor="middle" fontFamily={SANS} fontWeight={200} fontSize={r2(88 * k)} fill={ink} fillOpacity={0.85}>
          {(player.username.replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase()}
        </text>
      )}
      {showLevel && (
        <text x={cx} y={r2(262 * k)} textAnchor="middle" fill={soft} {...label(9.5)}>
          {levelLabel}
        </text>
      )}

      {/* header row */}
      <text x={X} y={r2(50 * k)} fill={soft} {...label(9.5)}>
        {GAME_MODE_LABELS[player.mode].long.toUpperCase()}
      </text>
      <text x={rightEdgeX(RIGHT, `ID ${player.id}`, { family: MONO, weight: 400, size: px(9.5), letterSpacing: r2(px(9.5) * 0.16) })} y={r2(50 * k)} fill={soft} {...label(9.5)}>
        {`ID ${player.id}`}
      </text>

      {/* name + identity line */}
      <text x={r2(X - 2 * k)} y={r2(106 * k)} fontFamily={SANS} fontWeight={600} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill={ink}>
        {name.text}
      </text>
      {showFlag && <Flag href={assets.flag} x={X} y={r2(121 * k)} w={flagW} rx={1.5} />}
      <text x={idX} y={r2(131.5 * k)} fontFamily={SANS} fontWeight={400} fontSize={idLine.size} fill={soft}>
        {idLine.text}
      </text>

      {/* hero */}
      {hero && (
        <g>
          <text x={X} y={r2(176 * k)} fill={soft} {...label(9.5)}>
            {heroLabel}
          </text>
          {hashW > 0 && (
            <text x={r2(X - 1 * k)} y={r2(252 * k)} fontFamily={SANS} fontWeight={300} fontSize={r2(hashSize)} fill={accent}>
              #
            </text>
          )}
          <text x={r2(X + hashW)} y={r2(252 * k)} fontFamily={SANS} fontWeight={200} fontSize={heroFit.size} letterSpacing={r2(heroFit.letterSpacing)} fill={hero.empty ? soft : ink}>
            {heroFit.text}
            {!isRank && hero.unit && (
              <tspan fontWeight={300} fontSize={r2(unitSize)} letterSpacing={0} fill={soft} dx={r2(4 * k)}>
                {hero.unit}
              </tspan>
            )}
          </text>
        </g>
      )}

      {/* ledger */}
      {ledgerKeys.length > 0 && <line x1={LX} y1={r2(ledgerTop)} x2={RIGHT} y2={r2(ledgerTop)} stroke={ink} strokeOpacity={0.8} strokeWidth={1} />}
      {ledgerKeys.map((key, i) => {
        const st = formatStat(key, s);
        const y = ledgerTop + rowH * (i + 1) - rowH * 0.36;
        const unitW = st.unit ? measureText(st.unit === "%" ? "%" : ` ${st.unit}`, { family: SANS, weight: 400, size: px(11) }) : 0;
        const labelW = measureText(STAT_LABELS[key].label.toUpperCase(), { family: MONO, weight: 400, size: px(9.5), letterSpacing: px(9.5) * 0.14 });
        const v = fitText(st.value, { family: SANS, weight: 500, maxWidth: RIGHT - LX - labelW - unitW - 10 * k, maxSize: valueSize, minSize: valueSize * 0.72 });
        return (
          <g key={key}>
            <text x={LX} y={r2(y)} fontFamily={MONO} fontWeight={400} fontSize={px(9.5)} letterSpacing={r2(px(9.5) * 0.14)} fill={soft}>
              {STAT_LABELS[key].label.toUpperCase()}
            </text>
            <text x={r2(RIGHT - v.width - unitW)} y={r2(y + 1 * k)} fontFamily={SANS} fontWeight={500} fontSize={v.size} fill={st.empty ? soft : ink}>
              {v.text}
              {st.unit && (
                <tspan fontWeight={400} fontSize={px(11)} fill={soft}>
                  {st.unit === "%" ? "%" : ` ${st.unit}`}
                </tspan>
              )}
            </text>
            <line x1={LX} y1={r2(ledgerTop + rowH * (i + 1))} x2={RIGHT} y2={r2(ledgerTop + rowH * (i + 1))} stroke={hair} />
          </g>
        );
      })}

      {/* machine-readable zone */}
      {ap.decorations && (
        <text x={X} y={r2(284 * k)} fontFamily={MONO} fontWeight={400} fontSize={r2(mrzSize)} letterSpacing={r2(mrzSpacing)} fill={mrzInk}>
          {mrz}
        </text>
      )}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "minimal",
  version: 2,
  name: "Minimal",
  tagline: "A premium digital ID: portrait, one number, a passport line",
  sizes: ["standard", "compact"],
  variants: [
    { id: "paper", name: "Paper", description: "Warm white, ink type" },
    { id: "graphite", name: "Graphite", description: "Near-black, same composition" },
  ],
  defaultVariant: "paper",
  legacyVariants: { ink: "graphite" },
  heroStats: ["globalRank", "countryRank", "level"],
  statRoles: { globalRank: "Headline", countryRank: "Identity line", level: "Ring around portrait" },
  ground: (config) => theme(config.variant).ground,
  contrastTarget: 3,
  statSlots: { standard: 4, compact: 3 },
  supports: { avatarShape: true, cover: false, effects: true, decorations: true },
  fonts: ["Hanken Grotesk", "JetBrains Mono"],
  Component: MinimalSvg,
};
