/**
 * Card configuration — the shape stored for every published card and edited
 * by the studio. Validated with Zod at every boundary (editor import, API,
 * database rows), versioned so old cards keep rendering after changes.
 */
import { z } from "zod";
import { GAME_MODES } from "../player/types";
import { STAT_KEYS, type StatKey } from "../player/format";

export const TEMPLATE_IDS = ["playerCard", "minimal", "editorial", "artistic", "cyberpunk", "y2k"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const CARD_SIZES = {
  standard: { id: "standard", name: "Standard", width: 900, height: 300 },
  compact: { id: "compact", name: "Compact", width: 640, height: 200 },
} as const;
export type CardSizeId = keyof typeof CARD_SIZES;
export type CardSize = (typeof CARD_SIZES)[CardSizeId];

/** Raster export scales. Cards are vector until rasterized, so every scale is sharp. */
export const EXPORT_SCALES = [1, 2, 3] as const;
export type ExportScale = (typeof EXPORT_SCALES)[number];

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex color like #ff5c9e");

export const cardConfigSchema = z.object({
  v: z.literal(1),
  player: z.object({
    id: z.number().int().positive(),
    mode: z.enum(GAME_MODES),
  }),
  template: z.enum(TEMPLATE_IDS),
  templateVersion: z.number().int().positive(),
  size: z.enum(["standard", "compact"]),
  variant: z.string().max(32).nullable(),
  colors: z.object({
    primary: hex,
    secondary: hex,
    accent: hex.nullable(),
  }),
  /** Enabled statistics, in display order. */
  stats: z.array(z.enum(STAT_KEYS)).max(STAT_KEYS.length),
  appearance: z.object({
    avatar: z.boolean(),
    avatarShape: z.enum(["round", "square"]),
    flag: z.boolean(),
    cover: z.boolean(),
    effects: z.boolean(),
    decorations: z.boolean(),
  }),
});

export type CardConfig = z.infer<typeof cardConfigSchema>;
export type Appearance = CardConfig["appearance"];

export const DEFAULT_STATS: StatKey[] = ["globalRank", "countryRank", "pp", "accuracy", "playCount", "level"];

export const DEFAULT_CONFIG: CardConfig = {
  v: 1,
  player: { id: 90000001, mode: "osu" },
  template: "playerCard",
  templateVersion: 1,
  size: "standard",
  variant: null,
  colors: { primary: "#ff5c9e", secondary: "#6ec6ff", accent: null },
  stats: DEFAULT_STATS,
  appearance: {
    avatar: true,
    avatarShape: "round",
    flag: true,
    cover: true,
    effects: true,
    decorations: true,
  },
};
