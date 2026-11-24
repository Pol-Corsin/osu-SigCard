import type { PlayerStats } from "./types";

export const STAT_KEYS = [
  "globalRank",
  "countryRank",
  "pp",
  "accuracy",
  "playCount",
  "level",
  "rankedScore",
  "medals",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, { label: string; short: string }> = {
  globalRank: { label: "Global rank", short: "Global" },
  countryRank: { label: "Country rank", short: "Country" },
  pp: { label: "Performance", short: "pp" },
  accuracy: { label: "Accuracy", short: "Acc" },
  playCount: { label: "Play count", short: "Plays" },
  level: { label: "Level", short: "Lv" },
  rankedScore: { label: "Ranked score", short: "Score" },
  medals: { label: "Medals", short: "Medals" },
};

const int = (n: number) => Math.round(n).toLocaleString("en-US");

/** 48213907552 → "48.2B", 913204 → "913.2K". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1e4) return int(n);
  const units: [number, string][] = [[1e3, "K"], [1e6, "M"], [1e9, "B"], [1e12, "T"]];
  let i = units.findLastIndex(([div]) => abs >= div);
  const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  let shown = round(n / units[i][0]);
  // 999.96B would round to "1000B": roll over to the next unit ("1T") instead.
  if (Math.abs(shown) >= 1000 && i < units.length - 1) {
    i++;
    shown = round(n / units[i][0]);
  }
  return `${shown}${units[i][1]}`;
}

export type FormattedStat = {
  key: StatKey;
  label: string;
  /** Main figure, e.g. "#4,812", "98.42", "8,437" */
  value: string;
  /** Optional unit rendered smaller, e.g. "%", "pp" */
  unit?: string;
  /** For rank stats with no rank (inactive players). */
  empty?: boolean;
};

export function formatStat(key: StatKey, s: PlayerStats): FormattedStat {
  const label = STAT_LABELS[key].label;
  switch (key) {
    case "globalRank":
      return s.globalRank == null
        ? { key, label, value: "—", empty: true }
        : { key, label, value: `#${int(s.globalRank)}` };
    case "countryRank":
      return s.countryRank == null
        ? { key, label, value: "—", empty: true }
        : { key, label, value: `#${int(s.countryRank)}` };
    case "pp":
      return { key, label, value: int(s.pp), unit: "pp" };
    case "accuracy":
      return { key, label, value: s.accuracy.toFixed(2), unit: "%" };
    case "playCount":
      return { key, label, value: s.playCount >= 1e7 ? compact(s.playCount) : int(s.playCount) };
    case "level":
      return { key, label, value: String(s.level.current) };
    case "rankedScore":
      return { key, label, value: compact(s.rankedScore) };
    case "medals":
      return { key, label, value: int(s.medals) };
  }
}
