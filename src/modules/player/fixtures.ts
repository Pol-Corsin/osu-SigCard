/**
 * Fictional sample players. Used by the editor until the osu! API is connected
 * (Phase 3), and permanently by tests and visual snapshot renders.
 * They cover the edge cases templates must handle: short and long names,
 * names with spaces/brackets, top-50 players, inactive modes with no rank,
 * huge scores, and a player without a cover.
 */
import type { GameMode, PlayerSnapshot, PlayerStats } from "./types";

type SampleProfile = {
  id: number;
  username: string;
  countryCode: string;
  countryName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  medals: number;
  modes: Record<GameMode, Omit<PlayerStats, "medals">>;
};

const FETCHED_AT = "2026-11-24T12:00:00.000Z";

const lvl = (v: number) => ({ current: Math.floor(v), progress: Math.round((v % 1) * 100) });

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: 90000001,
    username: "kairo_",
    countryCode: "JP",
    countryName: "Japan",
    avatarUrl: "/samples/avatar-kairo.png",
    coverUrl: "/samples/cover-kairo.png",
    medals: 187,
    modes: {
      osu: { globalRank: 4812, countryRank: 312, pp: 8437.21, accuracy: 98.42, playCount: 61204, level: lvl(101.37), rankedScore: 48213907552 },
      taiko: { globalRank: null, countryRank: null, pp: 812.4, accuracy: 95.1, playCount: 1204, level: lvl(42.08), rankedScore: 320111202 },
      fruits: { globalRank: 88231, countryRank: 6120, pp: 1530.9, accuracy: 97.66, playCount: 3310, level: lvl(61.5), rankedScore: 1203998001 },
      mania: { globalRank: 152004, countryRank: 9877, pp: 990.2, accuracy: 93.8, playCount: 2201, level: lvl(48.9), rankedScore: 801223450 },
    },
  },
  {
    id: 90000002,
    username: "Vellichor",
    countryCode: "DE",
    countryName: "Germany",
    avatarUrl: "/samples/avatar-vellichor.png",
    coverUrl: "/samples/cover-vellichor.png",
    medals: 241,
    modes: {
      osu: { globalRank: 31877, countryRank: 1904, pp: 5511.6, accuracy: 96.73, playCount: 40211, level: lvl(100.12), rankedScore: 21004331877 },
      taiko: { globalRank: 120443, countryRank: 6102, pp: 1101, accuracy: 94.2, playCount: 2880, level: lvl(55.71), rankedScore: 802114001 },
      fruits: { globalRank: null, countryRank: null, pp: 210, accuracy: 91.02, playCount: 340, level: lvl(22.4), rankedScore: 40211002 },
      mania: { globalRank: 1203, countryRank: 64, pp: 11904.3, accuracy: 97.81, playCount: 88532, level: lvl(103.12), rankedScore: 92441009113 },
    },
  },
  {
    id: 90000003,
    username: "[Saffron Tide]",
    countryCode: "BR",
    countryName: "Brazil",
    avatarUrl: "/samples/avatar-saffron.png",
    coverUrl: "/samples/cover-saffron.png",
    medals: 96,
    modes: {
      osu: { globalRank: 64409, countryRank: 2210, pp: 4420, accuracy: 97.05, playCount: 22841, level: lvl(99.81), rankedScore: 9988012345 },
      taiko: { globalRank: 45012, countryRank: 1503, pp: 2804.7, accuracy: 96.3, playCount: 9821, level: lvl(81.02), rankedScore: 3022109877 },
      fruits: { globalRank: 902, countryRank: 31, pp: 7830.5, accuracy: 99.12, playCount: 35670, level: lvl(102.66), rankedScore: 41023887120 },
      mania: { globalRank: null, countryRank: null, pp: 0, accuracy: 88.1, playCount: 87, level: lvl(9.33), rankedScore: 1204452 },
    },
  },
  {
    id: 90000004,
    username: "Ostrander_Hale",
    countryCode: "US",
    countryName: "United States",
    avatarUrl: "/samples/avatar-ostrander.png",
    coverUrl: null,
    medals: 34,
    modes: {
      osu: { globalRank: 245019, countryRank: 41022, pp: 2104.8, accuracy: 94.71, playCount: 8120, level: lvl(84.3), rankedScore: 2201876554 },
      taiko: { globalRank: 18872, countryRank: 2390, pp: 3602, accuracy: 97.9, playCount: 12034, level: lvl(90.44), rankedScore: 6022871223 },
      fruits: { globalRank: null, countryRank: null, pp: 0, accuracy: 0, playCount: 0, level: lvl(1), rankedScore: 0 },
      mania: { globalRank: 301228, countryRank: 52210, pp: 402.1, accuracy: 90.02, playCount: 980, level: lvl(31.9), rankedScore: 210334987 },
    },
  },
  {
    id: 90000005,
    username: "noel",
    countryCode: "FI",
    countryName: "Finland",
    avatarUrl: "/samples/avatar-noel.png",
    coverUrl: "/samples/cover-noel.png",
    medals: 312,
    modes: {
      osu: { globalRank: 27, countryRank: 1, pp: 19870.4, accuracy: 98.97, playCount: 152330, level: lvl(107.88), rankedScore: 312004558123 },
      taiko: { globalRank: 3021, countryRank: 22, pp: 6120, accuracy: 98.1, playCount: 7400, level: lvl(88.1), rankedScore: 5540111002 },
      fruits: { globalRank: 7710, countryRank: 40, pp: 4980, accuracy: 98.55, playCount: 6034, level: lvl(84.9), rankedScore: 4021998654 },
      mania: { globalRank: 22810, countryRank: 144, pp: 4012.6, accuracy: 96.4, playCount: 9102, level: lvl(80.2), rankedScore: 3988120443 },
    },
  },
];

export function sampleSnapshot(profileId: number, mode: GameMode): PlayerSnapshot {
  const p = SAMPLE_PROFILES.find((x) => x.id === profileId) ?? SAMPLE_PROFILES[0];
  return {
    id: p.id,
    username: p.username,
    countryCode: p.countryCode,
    countryName: p.countryName,
    avatarUrl: p.avatarUrl,
    coverUrl: p.coverUrl,
    mode,
    stats: { ...p.modes[mode], medals: p.medals },
    fetchedAt: FETCHED_AT,
    isSample: true,
  };
}
