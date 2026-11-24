"use client";
import { useEffect, useMemo, useState } from "react";
import { SAMPLE_PROFILES, sampleSnapshot } from "@/modules/player/fixtures";
import type { PlayerResult } from "@/modules/player/service-types";
import type { PlayerSnapshot } from "@/modules/player/types";
import { getTemplate } from "@/modules/templates/registry";
import { fetchPlayer, PlayerLookupError } from "./playerApi";
import { useStudio } from "./store";
import { useCardAssets } from "./useCardAssets";

export const isSampleId = (id: number) => SAMPLE_PROFILES.some((p) => p.id === id);

/**
 * Keeps the cached live player in sync with the card's player id + mode.
 * Mount once (in Studio). Refreshes once per session per player/mode, and
 * whenever the mode changes; the previous snapshot stays visible meanwhile.
 */
export function useLivePlayerSync() {
  const { id, mode } = useStudio((s) => s.config.player);
  const setLive = useStudio((s) => s.setLive);
  const setSyncError = useStudio((s) => s.setSyncError);
  const nonce = useStudio((s) => s.syncNonce);
  const key = `${id}:${mode}`;
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const needsFetch = !isSampleId(id) && !loaded.has(key);

  useEffect(() => {
    if (!needsFetch) return;
    const ctrl = new AbortController();
    fetchPlayer({ id }, mode, ctrl.signal)
      .then((r) => {
        setLive(r);
        setLoaded((prev) => new Set(prev).add(key));
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        const err = e instanceof PlayerLookupError ? e : new PlayerLookupError("unknown", "Couldn't refresh this player.");
        setSyncError({ key, code: err.code, message: err.message, retryAfter: err.retryAfter });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, needsFetch]);
}

export type PlayerStatus =
  | { kind: "sample" }
  | { kind: "live"; source: PlayerResult["source"]; warning?: string; error?: string }
  | { kind: "loading" }
  | { kind: "error"; message: string };

/** Derived data every studio panel needs: config, player snapshot, template, browser assets. */
export function useStudioData() {
  const config = useStudio((s) => s.config);
  const live = useStudio((s) => s.live);
  const syncError = useStudio((s) => s.syncError);
  const { id, mode } = config.player;
  const key = `${id}:${mode}`;
  const error = syncError?.key === key ? syncError.message : undefined;

  const { player, status } = useMemo((): { player: PlayerSnapshot; status: PlayerStatus } => {
    if (isSampleId(id)) return { player: sampleSnapshot(id, mode), status: { kind: "sample" } };
    if (live && live.player.id === id) {
      if (live.player.mode === mode) {
        return { player: live.player, status: { kind: "live", source: live.source, warning: live.warning, error } };
      }
      return { player: live.player, status: error ? { kind: "error", message: error } : { kind: "loading" } };
    }
    // Live player with nothing cached (e.g. storage cleared): show a sample until it loads.
    return { player: sampleSnapshot(SAMPLE_PROFILES[0].id, mode), status: error ? { kind: "error", message: error } : { kind: "loading" } };
  }, [id, mode, live, error]);

  const template = getTemplate(config.template);
  const { assets, failed } = useCardAssets(player);
  return { config, player, playerStatus: status, template, assets, failedAssets: failed };
}
