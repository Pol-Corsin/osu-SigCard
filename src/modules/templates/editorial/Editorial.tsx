/**
 * EDITORIAL — a Japanese magazine / poster page.
 *
 * Asymmetric composition: a coloured spine carrying the game mode in vertical
 * katakana, the avatar offset over a large primary disc, the global rank set
 * as the headline numeral, the player as the byline, a bilingual stat table
 * under a double rule, and performance stamped as a red hanko seal.
 */
import { mix, onColor } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Avatar, Flag, has, pickStats, r2 } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";
import JP from "./japanese.json";

const MINCHO = "Shippori Mincho" as const;
const GOTHIC = "Zen Kaku Gothic New" as const;

const LAYOUT = {
  standard: {
    spine: 64, kana: { size: 15, step: 20, top: 44 }, issue: { size: 9 },
    disc: { cx: 226, cy: 184, r: 108 }, avatar: { x: 132, y: 56, s: 128 },
    x0: 336, x1: 868,
    top: { y: 52, size: 10.5 },
    numeral: { baseline: 164, max: 122, min: 60, maxWidth: 330 },
    byline: { baseline: 100, max: 40, min: 18, sub: 12, subY: 124, modeY: 143 },
    rule: { y: 184 },
    table: { jpY: 214, valueY: 260, jp: 12, en: 8.5, value: 27, unit: 14 },
    seal: { s: 78, y: 198 },
    marks: 14,
  },
  compact: {
    spine: 44, kana: { size: 11.5, step: 15, top: 30 }, issue: { size: 7.5 },
    disc: { cx: 154, cy: 124, r: 76 }, avatar: { x: 90, y: 38, s: 88 },
    x0: 240, x1: 618,
    top: { y: 34, size: 8.5 },
    numeral: { baseline: 112, max: 84, min: 44, maxWidth: 220 },
    byline: { baseline: 64, max: 28, min: 14, sub: 9.5, subY: 82, modeY: 97 },
    rule: { y: 126 },
    table: { jpY: 150, valueY: 182, jp: 10, en: 7, value: 20, unit: 11 },
    seal: { s: 58, y: 134 },
    marks: 10,
  },
};

const jpStat = (k: StatKey) => (JP.stats as Record<StatKey, string>)[k];

function EditorialSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const L = LAYOUT[size.id];
  const { width: W, height: H } = size;
  const { appearance: ap, colors } = config;
  const sumi = config.variant === "sumi";

  const paper = template.ground(config);
  const ink = sumi ? "#ece9e1" : "#141317";
  const inkSoft = mix(ink, paper, 0.38);
  const spineInk = onColor(colors.secondary, "#ffffff", "#141317");
  const sealInk = onColor(colors.primary, "#ffffff", "#141317");

  // ---- spine: vertical katakana for the mode + issue number ----
  const kana = Array.from(JP.modes[player.mode]);

  // ---- headline numeral: global rank ----
  const showRank = has(config, "globalRank");
  const rank = player.stats.globalRank;
  const numeralText = rank == null ? "圏外" : rank.toLocaleString("en-US");
  const numeral = showRank
    ? fitText(numeralText, { family: MINCHO, weight: 800, maxWidth: L.numeral.maxWidth, maxSize: L.numeral.max, minSize: L.numeral.min, trackingEm: rank == null ? 0.04 : -0.03 })
    : null;

  // ---- byline ----
  const bylineLeft = numeral ? L.x0 + numeral.width + 30 : L.x0;
  const bylineAnchor = numeral ? "end" : "start";
  const bylineX = numeral ? L.x1 : L.x0;
  const name = fitText(player.username, {
    family: MINCHO, weight: 800, maxWidth: L.x1 - bylineLeft, maxSize: numeral ? L.byline.max : L.byline.max * 1.6, minSize: L.byline.min, trackingEm: -0.01,
  });
  const showCountryRank = has(config, "countryRank");
  const subText = showCountryRank
    ? `${player.countryName} · ${JP.stats.countryRank} ${player.stats.countryRank ? "#" + player.stats.countryRank.toLocaleString("en-US") : "—"}`
    : player.countryName;
  const sub = fitText(subText, { family: GOTHIC, weight: 400, maxWidth: L.x1 - bylineLeft - (ap.flag && assets.flag ? 26 : 0), maxSize: L.byline.sub, minSize: L.byline.sub * 0.75 });
  const subW = sub.width;
  const flagW = L.byline.sub * 1.5;

  // ---- seal: performance ----
  const showSeal = has(config, "pp");
  const pp = formatStat("pp", player.stats);
  const S = L.seal.s;
  const sealX = L.x1 - S;
  const sealValue = fitText(pp.value, { family: MINCHO, weight: 800, maxWidth: S - 16, maxSize: S * 0.25, minSize: S * 0.15 });

  // ---- table ----
  const keys = pickStats(config, template.heroStats, template.statSlots[size.id]);
  const tableRight = showSeal ? sealX - 18 : L.x1;
  const colW = (tableRight - L.x0) / Math.max(keys.length, 3);

  const date = new Date(player.fetchedAt);
  const dateline = `${date.getUTCFullYear()} · ${String(date.getUTCMonth() + 1).padStart(2, "0")} · ${String(date.getUTCDate()).padStart(2, "0")}`;

  const D = L.disc;
  const A = L.avatar;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <filter id={`${id}-washi`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.75 0.035" numOctaves={2} seed={7} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values={`0 0 0 0 ${sumi ? 1 : 0}  0 0 0 0 ${sumi ? 1 : 0}  0 0 0 0 ${sumi ? 1 : 0}  0 0 0 ${sumi ? 0.05 : 0.055} 0`} />
        </filter>
        <pattern id={`${id}-halftone`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
          <circle cx="2.5" cy="2.5" r="1.05" fill="#000" fillOpacity={0.16} />
        </pattern>
        <clipPath id={`${id}-disc`}>
          <circle cx={D.cx} cy={D.cy} r={D.r} />
        </clipPath>
      </defs>

      {/* paper */}
      <rect width={W} height={H} fill={paper} />
      {ap.effects && <rect width={W} height={H} filter={`url(#${id}-washi)`} />}

      {/* spine */}
      <rect width={L.spine} height={H} fill={colors.secondary} />
      {kana.map((ch, i) => (
        <text key={i} x={L.spine / 2} y={L.kana.top + i * L.kana.step} textAnchor="middle" fontFamily={GOTHIC} fontWeight={700} fontSize={L.kana.size} fill={spineInk}>
          {ch}
        </text>
      ))}
      <text
        transform={`translate(${L.spine / 2 + L.issue.size * 0.35} ${H - L.marks - 4}) rotate(-90)`}
        fontFamily={GOTHIC}
        fontWeight={400}
        fontSize={L.issue.size}
        letterSpacing={2}
        fill={spineInk}
        fillOpacity={0.8}
      >
        {`No. ${player.id}`}
      </text>

      {/* disc + avatar */}
      <circle cx={D.cx} cy={D.cy} r={D.r} fill={colors.primary} />
      {ap.effects && <rect x={D.cx - D.r} y={D.cy - D.r} width={D.r * 2} height={D.r * 2} fill={`url(#${id}-halftone)`} clipPath={`url(#${id}-disc)`} />}
      {ap.decorations && (
        <rect x={A.x + 7} y={A.y + 7} width={A.s} height={A.s} rx={ap.avatarShape === "round" ? A.s / 2 : 0} fill="none" stroke={ink} strokeWidth={0.8} />
      )}
      {ap.avatar ? (
        <Avatar
          id={`${id}-av`}
          x={A.x}
          y={A.y}
          w={A.s}
          h={A.s}
          href={assets.avatar}
          username={player.username}
          shape={ap.avatarShape === "round" ? "round" : { rx: 0 }}
          colors={{ a: mix(colors.primary, ink, 0.3), b: colors.secondary }}
          monogramFont={{ family: MINCHO, weight: 800 }}
        />
      ) : (
        <text x={D.cx} y={D.cy + D.r * 0.3} textAnchor="middle" fontFamily={MINCHO} fontWeight={800} fontSize={D.r * 0.9} fill={sealInk}>
          {JP.misc[0]}
        </text>
      )}

      {/* masthead line */}
      <text x={L.x0} y={L.top.y} fontFamily={GOTHIC} fontWeight={700} fontSize={L.top.size} letterSpacing={3} fill={inkSoft}>
        {numeral ? `${JP.stats.globalRank}　GLOBAL RANK` : `${JP.misc[0]}　PLAYER`}
      </text>
      <text x={L.x1} y={L.top.y} textAnchor="end" fontFamily={GOTHIC} fontWeight={400} fontSize={L.top.size} letterSpacing={2} fill={inkSoft}>
        {dateline}
      </text>

      {/* headline numeral */}
      {numeral && (
        <text x={L.x0 - numeral.size * 0.04} y={L.numeral.baseline} fontFamily={MINCHO} fontWeight={800} fontSize={numeral.size} letterSpacing={numeral.letterSpacing} fill={ink}>
          {numeral.text}
        </text>
      )}

      {/* byline */}
      <text x={bylineX} y={numeral ? L.byline.baseline : L.numeral.baseline - 18} textAnchor={bylineAnchor} fontFamily={MINCHO} fontWeight={800} fontSize={name.size} letterSpacing={name.letterSpacing} fill={ink}>
        {name.text}
      </text>
      {(() => {
        const y = numeral ? L.byline.subY : L.numeral.baseline + 6;
        const textX = numeral ? L.x1 : L.x0 + (ap.flag && assets.flag ? flagW + 8 : 0);
        const flagX = numeral ? L.x1 - subW - flagW - 8 : L.x0;
        return (
          <g>
            {ap.flag && <Flag href={assets.flag} x={r2(flagX)} y={r2(y - sub.size * 0.85)} w={flagW} rx={0} />}
            <text x={textX} y={y} textAnchor={bylineAnchor} fontFamily={GOTHIC} fontWeight={400} fontSize={sub.size} fill={ink}>
              {sub.text}
            </text>
          </g>
        );
      })()}
      {numeral && (
        <text x={L.x1} y={L.byline.modeY} textAnchor="end" fontFamily={GOTHIC} fontWeight={400} fontSize={L.byline.sub * 0.9} letterSpacing={1} fill={inkSoft}>
          {GAME_MODE_LABELS[player.mode].long}
        </text>
      )}

      {/* double rule */}
      <line x1={L.x0} y1={L.rule.y} x2={L.x1} y2={L.rule.y} stroke={ink} strokeWidth={1.4} />
      <line x1={L.x0} y1={L.rule.y + 4.5} x2={L.x1} y2={L.rule.y + 4.5} stroke={ink} strokeWidth={0.6} />

      {/* bilingual table */}
      {keys.map((k, i) => {
        const st = formatStat(k, player.stats);
        const x = L.x0 + i * colW;
        const jp = jpStat(k);
        const jpW = measureText(jp, { family: GOTHIC, weight: 700, size: L.table.jp });
        const unitW = st.unit ? measureText(st.unit, { family: MINCHO, weight: 700, size: L.table.unit }) + 2 : 0;
        const v = fitText(st.value, { family: MINCHO, weight: 700, maxWidth: colW - 16 - unitW, maxSize: L.table.value, minSize: L.table.value * 0.6 });
        const en = fitText(STAT_LABELS[k].label.toUpperCase(), { family: GOTHIC, weight: 400, maxWidth: colW - jpW - 22, maxSize: L.table.en, minSize: L.table.en * 0.8, letterSpacing: 1.2 });
        const showEn = !en.text.endsWith("…");
        return (
          <g key={k}>
            {i > 0 && <line x1={x - 10} y1={L.rule.y + 14} x2={x - 10} y2={L.table.valueY + 4} stroke={ink} strokeOpacity={0.2} strokeWidth={0.6} />}
            <text x={x} y={L.table.jpY} fontFamily={GOTHIC} fontWeight={700} fontSize={L.table.jp} fill={ink}>
              {jp}
            </text>
            {showEn && (
              <text x={x + jpW + 6} y={L.table.jpY} fontFamily={GOTHIC} fontWeight={400} fontSize={en.size} letterSpacing={1.2} fill={inkSoft}>
                {en.text}
              </text>
            )}
            <text x={x - 1} y={L.table.valueY} fontFamily={MINCHO} fontWeight={700} fontSize={v.size} fill={st.empty ? inkSoft : ink}>
              {v.text}
              {st.unit && (
                <tspan fontSize={L.table.unit} dx={2}>
                  {st.unit}
                </tspan>
              )}
            </text>
          </g>
        );
      })}

      {/* hanko seal */}
      {showSeal && (
        <g transform={`rotate(-6 ${sealX + S / 2} ${L.seal.y + S / 2})`}>
          <rect x={sealX} y={L.seal.y} width={S} height={S} rx={S * 0.05} fill={colors.primary} />
          <rect x={sealX + S * 0.07} y={L.seal.y + S * 0.07} width={S * 0.86} height={S * 0.86} rx={S * 0.03} fill="none" stroke={sealInk} strokeOpacity={0.75} strokeWidth={S * 0.018} />
          <text x={sealX + S / 2} y={L.seal.y + S * 0.3} textAnchor="middle" fontFamily={GOTHIC} fontWeight={700} fontSize={S * 0.13} letterSpacing={S * 0.04} fill={sealInk}>
            {JP.stats.pp}
          </text>
          <text x={sealX + S / 2} y={L.seal.y + S * 0.62} textAnchor="middle" fontFamily={MINCHO} fontWeight={800} fontSize={sealValue.size} fill={sealInk}>
            {sealValue.text}
          </text>
          <text x={sealX + S / 2} y={L.seal.y + S * 0.82} textAnchor="middle" fontFamily={GOTHIC} fontWeight={700} fontSize={S * 0.12} letterSpacing={S * 0.05} fill={sealInk}>
            PP
          </text>
        </g>
      )}

      {/* registration marks */}
      {ap.decorations && (
        <g stroke={ink} strokeOpacity={0.55} strokeWidth={0.6} fill="none">
          {[
            [W - L.marks, L.marks],
            [W - L.marks, H - L.marks],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={L.marks * 0.32} />
              <line x1={x - L.marks * 0.6} y1={y} x2={x + L.marks * 0.6} y2={y} />
              <line x1={x} y1={y - L.marks * 0.6} x2={x} y2={y + L.marks * 0.6} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

export const template: CardTemplate = {
  id: "editorial",
  version: 1,
  name: "Editorial",
  tagline: "Japanese poster page with a hanko seal",
  sizes: ["standard", "compact"],
  variants: [
    { id: "washi", name: "Washi", description: "Light paper, ink type" },
    { id: "sumi", name: "Sumi", description: "Ink-black paper, light type" },
  ],
  defaultVariant: "washi",
  heroStats: ["globalRank", "countryRank", "pp"],
  statRoles: { globalRank: "Headline numeral", countryRank: "Byline", pp: "Hanko seal" },
  statSlots: { standard: 4, compact: 3 },
  ground: (config) => (config.variant === "sumi" ? mix("#17161b", config.colors.secondary, 0.05) : mix("#efeee9", config.colors.secondary, 0.04)),
  // Primary is used for the disc and seal (shapes), never for text on paper.
  contrastTarget: null,
  supports: { avatarShape: true, cover: false, effects: true, decorations: true },
  fonts: ["Shippori Mincho", "Zen Kaku Gothic New"],
  Component: EditorialSvg,
};
