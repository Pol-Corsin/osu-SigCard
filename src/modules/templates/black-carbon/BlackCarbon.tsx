/**
 * BLACK CARBON — high-end technical materials.
 * A true 2×2 twill weave (or forged carbon) under a lacquer sheen and a
 * vignette, a machined knurled bezel around the portrait with the level arc
 * outside it, and a satin spec plate edged by one pinstripe in the primary
 * colour. Text sits on calm areas (satin plate, vignetted carbon) in
 * near-white figures and light-grey labels, so the texture never competes.
 */
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Flag, has, pickStats, r2, rightEdgeX } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const SANS = "Hanken Grotesk" as const;
const FIGURE = "#F5F6F8";
const LABEL = "#A9ADB6";
const SERIAL = "#80848D";

function BlackCarbonSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const { width: W, height: H } = size;
  const k = H / 300;
  const { appearance: ap } = config;
  const accent = config.colors.primary;
  const forged = config.variant === "forged";
  const s = player.stats;
  const px = (n: number) => r2(Math.max(7, n * k));
  const tow = 6 * k;

  // ---- bezel
  const cx = 136 * k;
  const cy = 150 * k;
  const R = 68 * k;
  const showLevel = has(config, "level");
  const prog = Math.min(1, Math.max(0.02, s.level.progress / 100));
  const arcR = R + 30 * k;

  // ---- identity column
  const X = 258 * k;
  const PLATE = W - 288 * k;
  const colRight = PLATE - 34 * k;
  const label = (n = 9) => ({ fontFamily: SANS, fontWeight: 500, fontSize: px(n), letterSpacing: r2(px(n) * 0.26) });

  const showFlag = ap.flag && !!assets.flag;
  const modeText = GAME_MODE_LABELS[player.mode].long.toUpperCase();
  const modeW = measureText(`${modeText}   /   `, { family: SANS, weight: 500, size: px(9), letterSpacing: px(9) * 0.26 });

  const name = fitText(player.username.toUpperCase(), { family: SANS, weight: 500, maxWidth: colRight - X, maxSize: 30 * k, minSize: 15 * k, trackingEm: 0.1 });

  const PLACED: StatKey[] = ["globalRank", "countryRank", "level"];
  const regular = pickStats(config, PLACED, 99);
  const heroKey: StatKey | null = has(config, "globalRank") ? "globalRank" : has(config, "countryRank") ? "countryRank" : (regular[0] ?? null);
  const hero = heroKey ? formatStat(heroKey, s) : null;
  const isRank = heroKey === "globalRank" || heroKey === "countryRank";
  const heroText = hero ? (hero.empty ? "Unranked" : hero.value + (!isRank && hero.unit ? (hero.unit === "%" ? "%" : ` ${hero.unit}`) : "")) : "";
  const heroLabel = heroKey === "globalRank" ? "GLOBAL RANK" : heroKey === "countryRank" ? `COUNTRY RANK · ${player.countryCode}` : heroKey ? STAT_LABELS[heroKey].label.toUpperCase() : "";
  const heroFit = fitText(heroText, { family: SANS, weight: 200, maxWidth: colRight - X + 6 * k, maxSize: 80 * k, minSize: 40 * k, trackingEm: -0.03 });

  const national =
    heroKey !== "countryRank" && has(config, "countryRank")
      ? s.countryRank == null
        ? `UNRANKED IN ${player.countryName.toUpperCase()}`
        : `#${s.countryRank.toLocaleString("en-US")} ${player.countryName.toUpperCase()}`
      : player.countryName.toUpperCase();
  const serial = fitText(`SC-${player.id}  ·  ${national}`, { family: SANS, weight: 500, maxWidth: colRight - X, maxSize: px(8.5), minSize: 7, trackingEm: 0.26 });

  // ---- spec plate
  const rows = pickStats(config, [...PLACED, ...(isRank || !heroKey ? [] : [heroKey])], template.statSlots[size.id]);
  const rowY = [86, 140, 194].map((y) => y * k);
  const plateL = PLATE + 30 * k;
  const plateR = W - 34 * k;

  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const r0 = R + 17 * k;
    const r1 = R + (i % 6 === 0 ? 23 : 20.5) * k;
    return (
      <line
        key={i}
        x1={r2(cx + r0 * Math.cos(a))}
        y1={r2(cy + r0 * Math.sin(a))}
        x2={r2(cx + r1 * Math.cos(a))}
        y2={r2(cy + r1 * Math.sin(a))}
        stroke="#C9CCD2"
        strokeOpacity={i % 6 === 0 ? 0.55 : 0.22}
        strokeWidth={1}
      />
    );
  });

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <linearGradient id={`${id}-towH`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B0B0D" />
          <stop offset="0.5" stopColor="#1F2024" />
          <stop offset="1" stopColor="#0B0B0D" />
        </linearGradient>
        <linearGradient id={`${id}-towV`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#09090B" />
          <stop offset="0.5" stopColor="#17181B" />
          <stop offset="1" stopColor="#09090B" />
        </linearGradient>
        {/* 2×2 twill: over two, under two, shifted one tow per row → diagonal stair-step */}
        <pattern id={`${id}-twill`} width={r2(tow * 4)} height={r2(tow * 4)} patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          {Array.from({ length: 16 }, (_, i) => {
            const r = Math.floor(i / 4);
            const c = i % 4;
            return <rect key={i} x={r2(c * tow)} y={r2(r * tow)} width={r2(tow)} height={r2(tow)} fill={`url(#${id}-${(c + r) % 4 < 2 ? "towH" : "towV"})`} />;
          })}
        </pattern>
        <filter id={`${id}-forged`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="turbulence" baseFrequency={`${r2(0.045 / k * 1000) / 1000} ${r2(0.07 / k * 1000) / 1000}`} numOctaves={2} seed={11} />
          <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0.05 0.09 0.06 0.12 0.07 0.1 0.055" />
            <feFuncG type="discrete" tableValues="0.05 0.09 0.06 0.12 0.07 0.1 0.055" />
            <feFuncB type="discrete" tableValues="0.056 0.1 0.066 0.132 0.077 0.11 0.06" />
          </feComponentTransfer>
        </filter>
        <linearGradient id={`${id}-lacquer`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.32" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.015" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-vig`} cx="0.3" cy="0.45" r="0.85">
          <stop offset="0.4" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.42" />
        </radialGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17181B" />
          <stop offset="1" stopColor="#0E0F11" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2F3F5" />
          <stop offset="0.3" stopColor="#7D828C" />
          <stop offset="0.52" stopColor="#E6E8EC" />
          <stop offset="0.75" stopColor="#4B4F57" />
          <stop offset="1" stopColor="#B9BDC4" />
        </linearGradient>
        <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B4B8C0" />
        </linearGradient>
        <clipPath id={`${id}-av`}>
          <circle cx={r2(cx)} cy={r2(cy)} r={r2(R)} />
        </clipPath>
      </defs>

      {/* material */}
      {forged ? (
        <>
          <rect width={W} height={H} fill="#0A0A0C" />
          <rect width={W} height={H} filter={`url(#${id}-forged)`} />
        </>
      ) : (
        <rect width={W} height={H} fill={`url(#${id}-twill)`} />
      )}
      {ap.effects && <rect width={W} height={H} fill={`url(#${id}-lacquer)`} />}
      <rect width={W} height={H} fill={`url(#${id}-vig)`} />

      {/* satin spec plate */}
      <rect x={r2(PLATE)} y={0} width={r2(W - PLATE)} height={H} fill={`url(#${id}-plate)`} />
      <rect x={r2(PLATE)} y={0} width={1} height={H} fill="#ffffff" opacity={0.09} />
      <rect x={r2(PLATE - 3 * k)} y={0} width={r2(Math.max(1.5, 2 * k))} height={H} fill={accent} />

      {/* machined bezel */}
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R + 26 * k)} fill="#0B0B0D" opacity={0.7} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R + 12 * k)} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={r2(9 * k)} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R + 7.2 * k)} fill="none" stroke="#000000" strokeOpacity={0.6} strokeWidth={1} />
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R + 16.8 * k)} fill="none" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.6} />
      {ap.decorations && ticks}
      {showLevel && (
        <path
          d={`M${r2(cx)} ${r2(cy - arcR)}A${r2(arcR)} ${r2(arcR)} 0 ${prog > 0.5 ? 1 : 0} 1 ${r2(cx + arcR * Math.sin(prog * 2 * Math.PI))} ${r2(cy - arcR * Math.cos(prog * 2 * Math.PI))}`}
          fill="none"
          stroke={accent}
          strokeWidth={r2(1.5 * k)}
          strokeLinecap="round"
        />
      )}
      {ap.avatar && assets.avatar ? (
        <image href={assets.avatar} x={r2(cx - R)} y={r2(cy - R)} width={r2(R * 2)} height={r2(R * 2)} clipPath={`url(#${id}-av)`} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <g>
          <circle cx={r2(cx)} cy={r2(cy)} r={r2(R)} fill="#1A1B1F" />
          <text x={r2(cx)} y={r2(cy + R * 0.32)} textAnchor="middle" fontFamily={SANS} fontWeight={200} fontSize={r2(R * 0.95)} fill={FIGURE} fillOpacity={0.85}>
            {(player.username.replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase()}
          </text>
        </g>
      )}
      <circle cx={r2(cx)} cy={r2(cy)} r={r2(R)} fill="none" stroke="#000000" strokeOpacity={0.5} strokeWidth={r2(2 * k)} />

      {/* identity */}
      <text x={r2(X)} y={r2(70 * k)} fill={LABEL} {...label()}>
        {`${modeText}   /   ${showFlag ? "" : player.countryCode}`}
      </text>
      {showFlag && <Flag href={assets.flag} x={r2(X + modeW)} y={r2(70 * k - 9 * k)} w={r2(14 * k)} rx={1} />}
      <text x={r2(X)} y={r2(70 * k + 14 * k + name.size * 0.72)} fontFamily={SANS} fontWeight={500} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill={`url(#${id}-silver)`}>
        {name.text}
      </text>
      <rect x={r2(X)} y={r2(136 * k)} width={r2(28 * k)} height={r2(Math.max(1, 1.5 * k))} fill={accent} />

      {hero && (
        <g>
          <text x={r2(X)} y={r2(178 * k)} fill={LABEL} {...label()}>
            {heroLabel}
          </text>
          <text x={r2(X - 3 * k)} y={r2(178 * k + heroFit.size * 0.78)} fontFamily={SANS} fontWeight={200} fontSize={heroFit.size} letterSpacing={r2(heroFit.letterSpacing)} fill={FIGURE} fillOpacity={hero.empty ? 0.75 : 1}>
            {heroFit.text}
          </text>
        </g>
      )}
      {ap.decorations && (
        <text x={r2(X)} y={r2(276 * k)} fontFamily={SANS} fontWeight={500} fontSize={serial.size} letterSpacing={r2(serial.letterSpacing)} fill={SERIAL}>
          {serial.text}
        </text>
      )}

      {/* spec sheet */}
      {rows.map((key, i) => {
        const st = formatStat(key, s);
        const y = rowY[i];
        const unit = st.unit ? (st.unit === "%" ? " %" : ` ${st.unit.toUpperCase()}`) : "";
        const unitW = unit ? measureText(unit, { family: SANS, weight: 500, size: px(11) }) : 0;
        const v = fitText(st.value, { family: SANS, weight: 300, maxWidth: plateR - plateL - unitW, maxSize: 29 * k, minSize: 15 * k, trackingEm: -0.01 });
        return (
          <g key={key}>
            <text x={r2(plateL)} y={r2(y - 16 * k)} fill={LABEL} {...label()}>
              {STAT_LABELS[key].label.toUpperCase()}
            </text>
            <text x={r2(plateR - v.width - unitW)} y={r2(y + 10 * k)} fontFamily={SANS} fontWeight={300} fontSize={v.size} letterSpacing={r2(v.letterSpacing)} fill={FIGURE} fillOpacity={st.empty ? 0.6 : 1}>
              {v.text}
              {unit && (
                <tspan fill={LABEL} fontWeight={500} fontSize={px(11)} letterSpacing={0}>
                  {unit}
                </tspan>
              )}
            </text>
            <line x1={r2(plateL)} y1={r2(y + 24 * k)} x2={r2(plateR)} y2={r2(y + 24 * k)} stroke="#ffffff" strokeOpacity={0.12} />
          </g>
        );
      })}
      {showLevel && (
        <g>
          <text x={r2(plateL)} y={r2(262 * k)} fill={LABEL} {...label()}>
            {`LEVEL ${s.level.current}`}
          </text>
          <text x={rightEdgeX(plateR, `${s.level.progress}%`, { family: SANS, weight: 500, size: px(9), letterSpacing: r2(px(9) * 0.26) })} y={r2(262 * k)} fill={LABEL} {...label()}>
            {`${s.level.progress}%`}
          </text>
          <rect x={r2(plateL)} y={r2(272 * k)} width={r2(plateR - plateL)} height={r2(Math.max(1.5, 2 * k))} fill="#ffffff" opacity={0.1} />
          <rect x={r2(plateL)} y={r2(272 * k)} width={r2((plateR - plateL) * prog)} height={r2(Math.max(1.5, 2 * k))} fill={accent} />
        </g>
      )}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "blackCarbon",
  version: 1,
  name: "Black Carbon",
  tagline: "Carbon fibre, a machined bezel and a satin spec plate",
  sizes: ["standard", "compact"],
  variants: [
    { id: "twill", name: "Twill", description: "Classic 2×2 twill weave" },
    { id: "forged", name: "Forged", description: "Marbled forged-carbon flakes" },
  ],
  defaultVariant: "twill",
  heroStats: ["globalRank", "countryRank", "level"],
  statRoles: { globalRank: "Headline", countryRank: "Engraved serial line", level: "Bezel arc and plate bar" },
  ground: () => "#0E0F11",
  contrastTarget: null,
  statSlots: { standard: 3, compact: 3 },
  supports: { avatarShape: false, cover: false, effects: true, decorations: true },
  fonts: ["Hanken Grotesk"],
  Component: BlackCarbonSvg,
};
