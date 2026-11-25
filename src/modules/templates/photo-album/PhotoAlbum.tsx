/**
 * PHOTO ALBUM — a page from a curated album about the player.
 * The cover art as a mounted print held by photo corners, the avatar as an
 * instant print taped over it with a handwritten note, a strip of 35mm
 * negatives, and the stats written as a photobook caption.
 *
 * Without cover art the mounted print becomes a contact sheet: six crops of
 * the avatar with edge numbers and one frame circled in grease pencil (or
 * colour studies when the avatar is hidden too), so the page always looks
 * deliberate.
 */
import type { ReactNode } from "react";
import { mix } from "../../color/color";
import { formatStat, STAT_LABELS, type StatKey } from "../../player/format";
import { GAME_MODE_LABELS } from "../../player/types";
import { fitText, measureText } from "../../render/measure";
import { Flag, has, pickStats, r2, rightEdgeX } from "../shared/primitives";
import type { CardTemplate, TemplateProps } from "../types";

const SERIF = "Instrument Serif" as const;
const HAND = "Caveat" as const;
const MONO = "Space Mono" as const;

const PAGES = {
  cream: { ground: "#EEE6D8", ink: "#2A241E", corner: "#3A3029", print: "#FBF8F2", gutter: 0.06 },
  slate: { ground: "#2B2D31", ink: "#EEE8DE", corner: "#151618", print: "#F4F0E8", gutter: 0.12 },
} as const;
type PageId = keyof typeof PAGES;
const page = (variant: string | null) => PAGES[(variant as PageId) in PAGES ? (variant as PageId) : "cream"];

const ROMAN = ["i.", "ii.", "iii."];
const BALLPOINT = "#2B2A6B";
const GREASE = "#E8432F";
const FILM_EDGE = "#E5A24A";

function PhotoAlbumSvg({ player, config, size, assets, idPrefix: id }: TemplateProps) {
  const { width: W, height: H } = size;
  const k = H / 300;
  const p = page(config.variant);
  const { appearance: ap } = config;
  const { primary, secondary } = config.colors;
  const s = player.stats;
  const px = (n: number) => r2(Math.max(7, n * k));
  const year = new Date(player.fetchedAt).getUTCFullYear();

  const avatar = ap.avatar ? assets.avatar : null;
  const cover = ap.cover ? assets.cover : null;

  // ---- print A: cover art, or a contact sheet
  const A = { cx: 214 * k, cy: 128 * k, w: 318 * k, h: 212 * k, b: 10 * k, bb: 12 * k, rot: -3.2 };
  const ax = A.cx - A.w / 2;
  const ay = A.cy - A.h / 2;
  const img = { x: ax + A.b, y: ay + A.b, w: A.w - A.b * 2, h: A.h - A.b - A.bb };
  const sheet = Array.from({ length: 6 }, (_, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const w = 88 * k;
    const h = 66 * k;
    const zoom = [1.1, 1.8, 1.35, 2.4, 1.05, 1.6][i];
    return { x: img.x + 11 * k + col * (w + 8 * k), y: img.y + 16 * k + row * (h + 22 * k), w, h, zoom, ox: [0, 18, 6, 30, 0, 10][i] * k, oy: [10, 20, 4, 26, 8, 16][i] * k };
  });

  // ---- print B: instant print with the avatar
  const B = { cx: 404 * k, cy: 176 * k, w: 146 * k, img: 128 * k, rot: 5.5 };
  const bh = B.img + 9 * k + 34 * k;
  const bx = B.cx - B.w / 2;
  const by = B.cy - bh / 2;
  // Handwriting uses a nickname: the first word of long names, as people write on prints.
  const first = player.username.replace(/[[\]()]/g, "").split(/[ _\-.]/).filter(Boolean)[0] ?? player.username;
  const handName = player.username.length > 11 ? first : player.username;
  const note = fitText(`${handName}, ’${String(year).slice(2)}`, { family: HAND, weight: 500, maxWidth: B.w - 20 * k, maxSize: 21 * k, minSize: 13 * k });

  // ---- film strip
  const film = { x: 18 * k, y: 246 * k, w: 300 * k, h: 58 * k, rot: -1.6 };
  const frames = [0, 1, 2].map((i) => ({ x: film.x + 14 * k + i * 94 * k, y: film.y + 11 * k, w: 86 * k, h: 36 * k }));

  // ---- caption column
  const X = W - 364 * k;
  const RIGHT = W - 34 * k;
  const name = fitText(player.username, { family: SERIF, weight: 400, maxWidth: RIGHT - X, maxSize: 60 * k, minSize: 28 * k, trackingEm: -0.01 });

  const PLACED: StatKey[] = ["globalRank", "countryRank", "level"];
  const regular = pickStats(config, PLACED, 99);
  const heroKey: StatKey | null = has(config, "globalRank") ? "globalRank" : has(config, "countryRank") ? "countryRank" : (regular[0] ?? null);
  const hero = heroKey ? formatStat(heroKey, s) : null;
  const isRank = heroKey === "globalRank" || heroKey === "countryRank";
  const heroValue = hero ? (hero.empty ? "Unranked" : isRank ? hero.value.replace(/^#/, "") : hero.value + (hero.unit ? (hero.unit === "%" ? "%" : ` ${hero.unit}`) : "")) : "";
  const heroTail = !hero ? "" : hero.empty ? (heroKey === "globalRank" ? "worldwide, for now" : `in ${player.countryName}, for now`) : heroKey === "globalRank" ? "in the world" : heroKey === "countryRank" ? `in ${player.countryName}` : STAT_LABELS[heroKey!].label.toLowerCase();
  const showNo = isRank && !hero?.empty;
  const noW = showNo ? 30 * k : 0;
  const tailSize = 17 * k;
  const tailW = measureText(heroTail, { family: SERIF, weight: 400, style: "italic", size: tailSize });
  const heroFit = fitText(heroValue, { family: SERIF, weight: 400, maxWidth: RIGHT - X - noW - tailW - 10 * k, maxSize: 50 * k, minSize: 26 * k, trackingEm: -0.01 });

  const home =
    heroKey !== "countryRank" && has(config, "countryRank")
      ? s.countryRank == null
        ? `${player.countryName}, not yet ranked at home.`
        : `${player.countryName}, number ${s.countryRank.toLocaleString("en-US")} at home.`
      : `${player.countryName}.`;
  const showFlag = ap.flag && !!assets.flag;
  const homeX = X + (showFlag ? 21 * k : 0);
  const homeFit = fitText(home, { family: SERIF, weight: 400, style: "italic", maxWidth: RIGHT - homeX, maxSize: 17 * k, minSize: 11 * k });

  const cols = pickStats(config, [...PLACED, ...(isRank || !heroKey ? [] : [heroKey])], template.statSlots[size.id]);
  const colW = (RIGHT - X) / 3;
  const plate = `PLATE ${player.id % 1000}  ·  ${GAME_MODE_LABELS[player.mode].long.toUpperCase()}  ·  ${year}`;

  const shadow = (x: number, y: number, w: number, h: number) =>
    ap.effects ? <rect x={r2(x + 3 * k)} y={r2(y + 6 * k)} width={r2(w)} height={r2(h)} fill="#000000" opacity={0.28} filter={`url(#${id}-shadow)`} /> : null;
  const corners = (x: number, y: number, w: number, h: number) => {
    const c = 18 * k;
    const o = 3 * k;
    return [
      `${x - o},${y - o} ${x + c},${y - o} ${x - o},${y + c}`,
      `${x + w + o},${y - o} ${x + w - c},${y - o} ${x + w + o},${y + c}`,
      `${x - o},${y + h + o} ${x + c},${y + h + o} ${x - o},${y + h - c}`,
      `${x + w + o},${y + h + o} ${x + w - c},${y + h + o} ${x + w + o},${y + h - c}`,
    ].map((pts, i) => <polygon key={i} points={pts.split(" ").map((pt) => pt.split(",").map((n) => r2(Number(n))).join(",")).join(" ")} fill={p.corner} />);
  };

  const printA: ReactNode = cover ? (
    <image href={cover} x={r2(img.x)} y={r2(img.y)} width={r2(img.w)} height={r2(img.h)} preserveAspectRatio="xMidYMid slice" />
  ) : (
    <g clipPath={`url(#${id}-a)`}>
      <rect x={r2(img.x)} y={r2(img.y)} width={r2(img.w)} height={r2(img.h)} fill="#141210" />
      {sheet.map((f, i) => (
        <g key={i}>
          {avatar ? (
            <image href={avatar} x={r2(f.x - f.zoom * f.ox)} y={r2(f.y - f.zoom * f.oy)} width={r2(f.w * f.zoom)} height={r2(f.w * f.zoom)} clipPath={`url(#${id}-cs${i})`} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x={r2(f.x)} y={r2(f.y)} width={r2(f.w)} height={r2(f.h)} fill={mix(i % 2 ? primary : secondary, "#141210", (i % 3) * 0.18)} />
          )}
          <text x={r2(f.x)} y={r2(f.y + f.h + 8.5 * k)} fontFamily={MONO} fontWeight={400} fontSize={px(6)} letterSpacing={r2(px(6) * 0.1)} fill={FILM_EDGE}>
            {`${i + 9}${i % 2 ? "A" : ""}`}
          </text>
        </g>
      ))}
      <rect
        x={r2(sheet[4].x - 4 * k)}
        y={r2(sheet[4].y - 4 * k)}
        width={r2(sheet[4].w + 8 * k)}
        height={r2(sheet[4].h + 8 * k)}
        rx={r2(7 * k)}
        fill="none"
        stroke={GREASE}
        strokeWidth={r2(2.4 * k)}
        strokeOpacity={0.9}
        transform={`rotate(-2 ${r2(sheet[4].x + sheet[4].w / 2)} ${r2(sheet[4].y + sheet[4].h / 2)})`}
      />
    </g>
  );

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <defs>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
          <feGaussianBlur stdDeviation={r2(5 * k)} />
        </filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.16  0 0 0 0 0.12  0 0 0 -1.1 0.62" />
        </filter>
        <filter id={`${id}-film`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.9 0.12 0 0 0.04  0.05 0.85 0.05 0 0.02  0 0.1 0.75 0 0  0 0 0 1 0" />
        </filter>
        <linearGradient id={`${id}-vignette`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>
        <clipPath id={`${id}-card`}>
          <rect width={W} height={H} />
        </clipPath>
        <clipPath id={`${id}-a`}>
          <rect x={r2(img.x)} y={r2(img.y)} width={r2(img.w)} height={r2(img.h)} />
        </clipPath>
        <clipPath id={`${id}-b`}>
          <rect x={r2(bx + 9 * k)} y={r2(by + 9 * k)} width={r2(B.img)} height={r2(B.img)} />
        </clipPath>
        {sheet.map((f, i) => (
          <clipPath key={i} id={`${id}-cs${i}`}>
            <rect x={r2(f.x)} y={r2(f.y)} width={r2(f.w)} height={r2(f.h)} />
          </clipPath>
        ))}
        {frames.map((f, i) => (
          <clipPath key={i} id={`${id}-f${i}`}>
            <rect x={r2(f.x)} y={r2(f.y)} width={r2(f.w)} height={r2(f.h)} rx={r2(1.5 * k)} />
          </clipPath>
        ))}
      </defs>

      <g clipPath={`url(#${id}-card)`}>
        <rect width={W} height={H} fill={p.ground} />
        {ap.effects && <rect width={W} height={H} filter={`url(#${id}-grain)`} opacity={0.22} />}
        <rect width={r2(26 * k)} height={H} fill="#000000" opacity={p.gutter} />

        {/* film strip */}
        {ap.decorations && (
          <g transform={`rotate(${film.rot} ${r2(film.x + film.w / 2)} ${r2(film.y + film.h / 2)})`}>
            {shadow(film.x, film.y, film.w, film.h)}
            <rect x={r2(film.x)} y={r2(film.y)} width={r2(film.w)} height={r2(film.h)} fill="#1B1612" />
            {Array.from({ length: 19 }, (_, i) => (
              <g key={i}>
                <rect x={r2(film.x + (8 + i * 15.5) * k)} y={r2(film.y + 3 * k)} width={r2(7 * k)} height={r2(4.5 * k)} rx={r2(1 * k)} fill={p.ground} opacity={0.85} />
                <rect x={r2(film.x + (8 + i * 15.5) * k)} y={r2(film.y + film.h - 7.5 * k)} width={r2(7 * k)} height={r2(4.5 * k)} rx={r2(1 * k)} fill={p.ground} opacity={0.85} />
              </g>
            ))}
            {frames.map((f, i) => {
              const src = i === 1 ? avatar : (cover ?? avatar);
              return src ? (
                <image
                  key={i}
                  href={src}
                  x={r2(f.x - i * 60 * k)}
                  y={r2(f.y - (i === 1 ? 25 * k : 0))}
                  width={r2(i === 1 ? f.w : f.w * 3.4)}
                  height={r2(i === 1 ? f.w : f.h)}
                  clipPath={`url(#${id}-f${i})`}
                  preserveAspectRatio="xMidYMid slice"
                  filter={`url(#${id}-film)`}
                />
              ) : (
                <rect key={i} x={r2(f.x)} y={r2(f.y)} width={r2(f.w)} height={r2(f.h)} rx={r2(1.5 * k)} fill={i === 1 ? primary : secondary} opacity={0.85} />
              );
            })}
            <text x={r2(film.x + 16 * k)} y={r2(film.y + film.h - 0.5 * k)} fontFamily={MONO} fontWeight={400} fontSize={r2(Math.max(5.5 * k, 4.5))} letterSpacing={r2(1.1 * k)} fill={FILM_EDGE}>
              {`SC 400   ${player.id}   12A   13   13A`}
            </text>
          </g>
        )}

        {/* print A */}
        <g transform={`rotate(${A.rot} ${r2(A.cx)} ${r2(A.cy)})`}>
          {shadow(ax, ay, A.w, A.h)}
          <rect x={r2(ax)} y={r2(ay)} width={r2(A.w)} height={r2(A.h)} fill={p.print} />
          {printA}
          {cover && <rect x={r2(img.x)} y={r2(img.y)} width={r2(img.w)} height={r2(img.h)} fill={`url(#${id}-vignette)`} />}
          {corners(ax, ay, A.w, A.h)}
        </g>

        {/* print B: instant print */}
        <g transform={`rotate(${B.rot} ${r2(B.cx)} ${r2(B.cy)})`}>
          {shadow(bx, by, B.w, bh)}
          <rect x={r2(bx)} y={r2(by)} width={r2(B.w)} height={r2(bh)} fill={p.print} />
          {avatar ? (
            <image href={avatar} x={r2(bx + 9 * k)} y={r2(by + 9 * k)} width={r2(B.img)} height={r2(B.img)} clipPath={`url(#${id}-b)`} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <g>
              <rect x={r2(bx + 9 * k)} y={r2(by + 9 * k)} width={r2(B.img)} height={r2(B.img)} fill={mix(primary, secondary, 0.35)} />
              <text x={r2(B.cx)} y={r2(by + 9 * k + B.img * 0.68)} textAnchor="middle" fontFamily={SERIF} fontWeight={400} fontStyle="italic" fontSize={r2(B.img * 0.62)} fill="#ffffff" fillOpacity={0.92}>
                {(player.username.replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase()}
              </text>
            </g>
          )}
          <text x={r2(bx + 12 * k)} y={r2(by + B.img + 36 * k)} fontFamily={HAND} fontWeight={500} fontSize={note.size} fill={BALLPOINT}>
            {note.text}
          </text>
          {ap.decorations && (
            <g transform={`rotate(-9 ${r2(B.cx)} ${r2(by)})`}>
              <path
                d={`M${r2(B.cx - 34 * k)} ${r2(by - 9 * k)}l${r2(68 * k)} 0l${r2(-2 * k)} ${r2(4 * k)}l${r2(2 * k)} ${r2(4 * k)}l${r2(-2 * k)} ${r2(4 * k)}l${r2(2 * k)} ${r2(4 * k)}l${r2(-68 * k)} 0l${r2(2 * k)} ${r2(-4 * k)}l${r2(-2 * k)} ${r2(-4 * k)}l${r2(2 * k)} ${r2(-4 * k)}z`}
                fill={primary}
                opacity={0.62}
              />
            </g>
          )}
        </g>

        {/* caption column */}
        <text x={r2(X)} y={r2(50 * k)} fontFamily={MONO} fontWeight={400} fontSize={px(9)} letterSpacing={r2(px(9) * 0.18)} fill={p.ink} fillOpacity={0.6}>
          {plate}
        </text>
        <text x={r2(X - 2 * k)} y={r2(104 * k)} fontFamily={SERIF} fontWeight={400} fontSize={name.size} letterSpacing={r2(name.letterSpacing)} fill={p.ink}>
          {name.text}
        </text>
        {showFlag && <Flag href={assets.flag} x={r2(X)} y={r2(130 * k - 11 * k)} w={r2(15 * k)} rx={1} />}
        <text x={r2(homeX)} y={r2(130 * k)} fontFamily={SERIF} fontWeight={400} fontStyle="italic" fontSize={homeFit.size} fill={p.ink} fillOpacity={0.75}>
          {homeFit.text}
        </text>
        <line x1={r2(X)} y1={r2(146 * k)} x2={r2(RIGHT)} y2={r2(146 * k)} stroke={p.ink} strokeOpacity={0.35} strokeWidth={1} />

        {hero && (
          <g>
            {showNo && (
              <text x={r2(X)} y={r2(196 * k)} fontFamily={SERIF} fontWeight={400} fontStyle="italic" fontSize={r2(26 * k)} fill={p.ink}>
                №
              </text>
            )}
            <text x={r2(X + noW)} y={r2(196 * k)} fontFamily={SERIF} fontWeight={400} fontSize={heroFit.size} letterSpacing={r2(heroFit.letterSpacing)} fill={p.ink} fillOpacity={hero.empty ? 0.7 : 1}>
              {heroFit.text}
            </text>
            <text x={r2(X + noW + heroFit.width + 8 * k)} y={r2(196 * k)} fontFamily={SERIF} fontWeight={400} fontStyle="italic" fontSize={r2(tailSize)} fill={p.ink} fillOpacity={0.7}>
              {heroTail}
            </text>
          </g>
        )}

        {cols.map((key, i) => {
          const st = formatStat(key, s);
          const x = X + i * colW;
          const unit = st.unit ? (st.unit === "%" ? "%" : ` ${st.unit}`) : "";
          const unitW = unit ? measureText(unit, { family: SERIF, weight: 400, style: "italic", size: 14 * k }) : 0;
          const v = fitText(st.value, { family: SERIF, weight: 400, maxWidth: colW - 12 * k - unitW, maxSize: 22 * k, minSize: 13 * k });
          const lab = fitText(`${ROMAN[i]} ${STAT_LABELS[key].label.toLowerCase()}`, { family: SERIF, weight: 400, style: "italic", maxWidth: colW - 8 * k, maxSize: px(12.5), minSize: 7 });
          return (
            <g key={key}>
              <text x={r2(x)} y={r2(248 * k)} fontFamily={SERIF} fontWeight={400} fontSize={v.size} fill={p.ink} fillOpacity={st.empty ? 0.6 : 1}>
                {v.text}
                {unit && (
                  <tspan fontStyle="italic" fontSize={r2(14 * k)}>
                    {unit}
                  </tspan>
                )}
              </text>
              <text x={r2(x)} y={r2(267 * k)} fontFamily={SERIF} fontWeight={400} fontStyle="italic" fontSize={lab.size} fill={p.ink} fillOpacity={0.65}>
                {lab.text}
              </text>
            </g>
          );
        })}
        {has(config, "level") && (
          <text x={rightEdgeX(RIGHT, `LV ${s.level.current}  ·  ${s.level.progress}%`, { family: MONO, weight: 400, size: px(8), letterSpacing: r2(px(8) * 0.18) })} y={r2(287 * k)} fontFamily={MONO} fontWeight={400} fontSize={px(8)} letterSpacing={r2(px(8) * 0.18)} fill={p.ink} fillOpacity={0.45}>
            {`LV ${s.level.current}  ·  ${s.level.progress}%`}
          </text>
        )}
      </g>
    </svg>
  );
}

export const template: CardTemplate = {
  id: "photoAlbum",
  version: 1,
  name: "Photo Album",
  tagline: "A curated album page: prints, negatives and a handwritten note",
  sizes: ["standard", "compact"],
  variants: [
    { id: "cream", name: "Cream", description: "Warm album page with fine grain" },
    { id: "slate", name: "Slate", description: "Dark album page, white prints" },
  ],
  defaultVariant: "cream",
  heroStats: ["globalRank", "countryRank", "level"],
  statRoles: { globalRank: "Caption headline", countryRank: "Caption line", level: "Corner mark" },
  ground: (config) => page(config.variant).ground,
  contrastTarget: null,
  statSlots: { standard: 3, compact: 3 },
  supports: { avatarShape: false, cover: true, effects: true, decorations: true },
  fonts: ["Instrument Serif", "Caveat", "Space Mono"],
  Component: PhotoAlbumSvg,
};
