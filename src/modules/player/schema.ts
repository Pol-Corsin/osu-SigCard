import { z } from "zod";
import { GAME_MODES } from "./types";

/** Validates PlayerSnapshot data that crosses a trust boundary (API responses, localStorage). */
export const playerSnapshotSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1).max(32),
  countryCode: z.string().length(2),
  countryName: z.string(),
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  mode: z.enum(GAME_MODES),
  stats: z.object({
    globalRank: z.number().nullable(),
    countryRank: z.number().nullable(),
    pp: z.number(),
    accuracy: z.number(),
    playCount: z.number(),
    level: z.object({ current: z.number(), progress: z.number() }),
    rankedScore: z.number(),
    medals: z.number(),
  }),
  fetchedAt: z.string(),
  isSample: z.boolean().optional(),
});

export const playerResultSchema = z.object({
  player: playerSnapshotSchema,
  source: z.enum(["api", "cache", "stale", "sample"]),
  warning: z.string().optional(),
});

export const recentPlayerSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  countryCode: z.string(),
});
export type RecentPlayer = z.infer<typeof recentPlayerSchema>;
