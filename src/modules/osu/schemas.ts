/**
 * The subset of the osu! API v2 UserExtended response we use
 * (GET /users/{user}/{mode}). Lenient on purpose: optional and nullable
 * wherever osu! may omit data, so a missing field degrades the card instead
 * of failing the lookup.
 */
import { z } from "zod";

const num = z.number().finite();

export const osuUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1),
  avatar_url: z.string().nullish(),
  country_code: z.string().nullish(),
  country: z.object({ code: z.string(), name: z.string() }).nullish(),
  cover_url: z.string().nullish(),
  cover: z.object({ url: z.string().nullish() }).partial().nullish(),
  user_achievements: z.array(z.unknown()).nullish(),
  statistics: z
    .object({
      global_rank: num.nullish(),
      country_rank: num.nullish(),
      pp: num.nullish(),
      hit_accuracy: num.nullish(),
      play_count: num.nullish(),
      ranked_score: num.nullish(),
      level: z.object({ current: num, progress: num }).partial().nullish(),
    })
    .partial()
    .nullish(),
});

export type OsuUser = z.infer<typeof osuUserSchema>;
