import type { GameMode, PlayerSnapshot } from "../player/types";
import type { OsuUser } from "./schemas";

/** Only these hosts may be used for images (the renderer fetches them server-side). */
const IMAGE_HOSTS = new Set(["a.ppy.sh", "assets.ppy.sh", "osu.ppy.sh"]);

function safeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, "https://osu.ppy.sh");
    return u.protocol === "https:" && IMAGE_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

const n = (v: number | null | undefined, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const rank = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? Math.round(v) : null);

export function normalizeUser(user: OsuUser, mode: GameMode, now = new Date()): PlayerSnapshot {
  const s = user.statistics ?? {};
  const code = (user.country?.code ?? user.country_code ?? "").toUpperCase();
  return {
    id: user.id,
    username: user.username,
    countryCode: /^[A-Z]{2}$/.test(code) ? code : "XX",
    countryName: user.country?.name ?? (code || "Unknown"),
    avatarUrl: safeImage(user.avatar_url),
    coverUrl: safeImage(user.cover?.url ?? user.cover_url),
    mode,
    stats: {
      globalRank: rank(s.global_rank),
      countryRank: rank(s.country_rank),
      pp: n(s.pp),
      accuracy: n(s.hit_accuracy),
      playCount: Math.round(n(s.play_count)),
      level: { current: Math.round(n(s.level?.current, 1)), progress: Math.round(n(s.level?.progress)) },
      rankedScore: n(s.ranked_score),
      medals: user.user_achievements?.length ?? 0,
    },
    fetchedAt: now.toISOString(),
  };
}
