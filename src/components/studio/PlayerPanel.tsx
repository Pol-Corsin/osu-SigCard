"use client";
import { useEffect, useState } from "react";
import { formatStat } from "@/modules/player/format";
import { GAME_MODE_LABELS } from "@/modules/player/types";
import { cx } from "../ui/controls";
import { ALL_STATS, useStudio } from "./store";
import { useStudioData, type PlayerStatus } from "./useStudioData";

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function relative(iso: string, now: number) {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  const map = {
    sample: { text: "Sample data", cls: "border-j50/50 text-j50" },
    loading: { text: "Loading…", cls: "border-j300/50 text-j300" },
    error: { text: "Couldn't refresh", cls: "border-miss/50 text-miss" },
    live: { text: "Live · osu!", cls: "border-j100/50 text-j100" },
    cache: { text: "Cached · osu!", cls: "border-j100/50 text-j100" },
    stale: { text: "Stale data", cls: "border-j50/50 text-j50" },
  } as const;
  const k = status.kind === "live" ? (status.source === "api" ? "live" : status.source === "cache" ? "cache" : status.source === "stale" ? "stale" : "sample") : status.kind;
  const v = map[k];
  return (
    <span className={cx("rounded-full border bg-ink/70 px-2 py-0.5 font-mono text-[10.5px] backdrop-blur", v.cls)} aria-live="polite">
      {v.text}
    </span>
  );
}

export function PlayerPanel() {
  const { player, assets, playerStatus: status } = useStudioData();
  const retry = useStudio((s) => s.retrySync);
  const now = useNow();
  const isSample = status.kind === "sample";
  const warning = status.kind === "live" ? (status.error ?? status.warning) : status.kind === "error" ? status.message : undefined;

  return (
    <section className="border-b border-line">
      <div className="relative h-[92px] overflow-hidden">
        {assets.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assets.cover} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#2a2636,#16141e)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-panel" />
        <span className="absolute right-3 top-3">
          <StatusBadge status={status} />
        </span>
      </div>
      <div className={cx("relative -mt-9 px-5 pb-5 transition-opacity", status.kind === "loading" && "opacity-60")}>
        <div className="flex items-end gap-3">
          {assets.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assets.avatar} alt={`${player.username}'s avatar`} className="relative size-16 rounded-[14px] bg-raised object-cover ring-4 ring-panel" />
          ) : (
            <div className="relative grid size-16 place-items-center rounded-[14px] bg-raised font-display text-2xl ring-4 ring-panel">
              {player.username[0]}
            </div>
          )}
          <div className="min-w-0 pb-1">
            <p className="truncate font-display text-[18px] font-semibold leading-tight text-text">{player.username}</p>
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              {assets.flag && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assets.flag} alt="" className="h-[11px] w-4 rounded-[2px]" />
              )}
              <span className="truncate">
                {player.countryName} · {GAME_MODE_LABELS[player.mode].long}
              </span>
            </p>
          </div>
        </div>

        {warning && (
          <div className="mt-4 rounded-ctl border border-j50/30 bg-j50/5 px-3 py-2 text-[11.5px] leading-4 text-j50">
            {warning}{" "}
            <button type="button" onClick={retry} className="font-semibold underline underline-offset-2 hover:text-text">
              Retry
            </button>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {ALL_STATS.map((k) => {
            const s = formatStat(k, player.stats);
            return (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] text-faint">{s.label}</dt>
                <dd className="truncate font-mono text-[13px] text-soft">
                  {s.value}
                  {s.unit && <span className="text-faint">{s.unit}</span>}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="mt-4 text-[11px] leading-4 text-faint">
          {isSample ? (
            "Fictional player for trying designs. Search above to use a real osu! profile."
          ) : (
            <>
              Updated {relative(player.fetchedAt, now)} ·{" "}
              <a href={`https://osu.ppy.sh/users/${player.id}`} target="_blank" rel="noreferrer" className="text-approach underline-offset-2 hover:underline">
                osu! profile
              </a>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
