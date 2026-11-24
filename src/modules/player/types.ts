/** osu! API v2 ruleset names. */
export const GAME_MODES = ["osu", "taiko", "fruits", "mania"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_MODE_LABELS: Record<GameMode, { short: string; long: string }> = {
  osu: { short: "osu!", long: "osu!standard" },
  taiko: { short: "taiko", long: "osu!taiko" },
  fruits: { short: "catch", long: "osu!catch" },
  mania: { short: "mania", long: "osu!mania" },
};

/** Normalized per-mode statistics. Ranks are null for inactive / unranked players. */
export type PlayerStats = {
  globalRank: number | null;
  countryRank: number | null;
  pp: number;
  accuracy: number; // 0–100
  playCount: number;
  level: { current: number; progress: number }; // progress 0–100
  rankedScore: number;
  medals: number;
};

/** Everything a card template needs to know about a player in one mode. */
export type PlayerSnapshot = {
  id: number;
  username: string;
  countryCode: string; // ISO 3166-1 alpha-2, upper case
  countryName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  mode: GameMode;
  stats: PlayerStats;
  fetchedAt: string; // ISO timestamp
  /** True for bundled sample data, never for API data. */
  isSample?: boolean;
};
