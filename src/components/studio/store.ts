"use client";
/**
 * Studio editor state. Holds exactly one CardConfig (the same shape that will
 * be stored for published cards), so "save" and "edit existing card" later are
 * just load/store of this object. Drafts persist in localStorage.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cardConfigSchema, DEFAULT_CONFIG, type Appearance, type CardConfig, type CardSizeId, type TemplateId } from "@/modules/cards/config";
import type { Hex } from "@/modules/color/color";
import { COLOR_PRESETS } from "@/modules/color/presets";
import type { StatKey } from "@/modules/player/format";
import { STAT_KEYS } from "@/modules/player/format";
import { playerResultSchema, recentPlayerSchema, type RecentPlayer } from "@/modules/player/schema";
import type { PlayerResult } from "@/modules/player/service-types";
import type { GameMode } from "@/modules/player/types";
import { getTemplate } from "@/modules/templates/registry";
import { z } from "zod";
import type { OwnerCardResponse } from "@/modules/cards/api-types";

/**
 * The published card this draft is linked to. Includes the private edit token,
 * kept only in this browser so the owner can keep editing.
 */
export type PublishedState = {
  card: OwnerCardResponse;
  editToken: string;
  editUrl: string;
};

const publishedSchema = z.object({
  card: z.object({ publicId: z.string().regex(/^[0-9A-Za-z]{10}$/), osuUserId: z.number(), version: z.number(), config: cardConfigSchema }).passthrough(),
  editToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  editUrl: z.string().url(),
});

type StudioState = {
  config: CardConfig;
  /** Published card linked to this draft, or null for an unpublished draft. */
  published: PublishedState | null;
  /** Idempotency key of an in-flight publish, reused if the user retries. */
  publishKey: string | null;
  setPublished: (p: PublishedState | null) => void;
  /** Update the linked card after an update/refresh (token unchanged unless given). */
  updatePublishedCard: (card: OwnerCardResponse, edit?: { editToken: string; editUrl: string }) => void;
  setPublishKey: (key: string | null) => void;
  /** Load a published card for editing (from a private edit link). */
  loadForEdit: (card: OwnerCardResponse, editToken: string, editUrl: string) => void;
  /** Last loaded live (osu! API) player, so reloads render instantly before refreshing. */
  live: PlayerResult | null;
  /** Recently searched live players, newest first. */
  recent: RecentPlayer[];
  setPlayer: (id: number) => void;
  /** Switch the card to a live player that was just loaded from the API. */
  selectLivePlayer: (result: PlayerResult) => void;
  /** Update the cached live player (e.g. after loading another mode). */
  setLive: (result: PlayerResult) => void;
  /** Transient (not persisted): last failed refresh for the current player key. */
  syncError: { key: string; code: string; message: string; retryAfter: number | null } | null;
  setSyncError: (e: StudioState["syncError"]) => void;
  syncNonce: number;
  retrySync: () => void;
  setMode: (mode: GameMode) => void;
  setTemplate: (id: TemplateId) => void;
  setSize: (size: CardSizeId) => void;
  setVariant: (variant: string) => void;
  setColor: (key: "primary" | "secondary", value: Hex) => void;
  setAccent: (value: Hex | null) => void;
  applyPreset: (presetId: string) => void;
  toggleStat: (key: StatKey) => void;
  moveStat: (key: StatKey, dir: -1 | 1) => void;
  setAppearance: (patch: Partial<Appearance>) => void;
  reset: () => void;
};

const patch = (s: StudioState, c: Partial<CardConfig>): Pick<StudioState, "config"> => ({ config: { ...s.config, ...c } });

export const useStudio = create<StudioState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      published: null,
      publishKey: null,
      setPublished: (p) => set({ published: p, publishKey: null }),
      updatePublishedCard: (card, edit) => set((s) => (s.published ? { published: { ...s.published, ...edit, card } } : s)),
      setPublishKey: (key) => set({ publishKey: key }),
      loadForEdit: (card, editToken, editUrl) =>
        set((s) => ({
          config: card.config,
          published: { card, editToken, editUrl },
          publishKey: null,
          live: { player: card.player, source: "cache" },
          recent: [
            { id: card.player.id, username: card.player.username, avatarUrl: card.player.avatarUrl, countryCode: card.player.countryCode },
            ...s.recent.filter((p) => p.id !== card.player.id),
          ].slice(0, 5),
        })),
      live: null,
      recent: [],
      selectLivePlayer: (r) =>
        set((s) => ({
          live: r,
          config: { ...s.config, player: { id: r.player.id, mode: r.player.mode } },
          recent: [
            { id: r.player.id, username: r.player.username, avatarUrl: r.player.avatarUrl, countryCode: r.player.countryCode },
            ...s.recent.filter((p) => p.id !== r.player.id),
          ].slice(0, 5),
        })),
      setLive: (r) => set({ live: r, syncError: null }),
      syncError: null,
      setSyncError: (e) => set({ syncError: e }),
      syncNonce: 0,
      retrySync: () => set((s) => ({ syncNonce: s.syncNonce + 1, syncError: null })),
      setPlayer: (id) => set((s) => patch(s, { player: { ...s.config.player, id } })),
      setMode: (mode) => set((s) => patch(s, { player: { ...s.config.player, mode } })),
      setTemplate: (id) =>
        set((s) => {
          const t = getTemplate(id);
          return patch(s, {
            template: id,
            templateVersion: t.version,
            size: t.sizes.includes(s.config.size) ? s.config.size : t.sizes[0],
            variant: t.defaultVariant,
          });
        }),
      setSize: (size) => set((s) => patch(s, { size })),
      setVariant: (variant) => set((s) => patch(s, { variant })),
      setColor: (key, value) => set((s) => patch(s, { colors: { ...s.config.colors, [key]: value } })),
      setAccent: (value) => set((s) => patch(s, { colors: { ...s.config.colors, accent: value } })),
      applyPreset: (presetId) =>
        set((s) => {
          const p = COLOR_PRESETS.find((x) => x.id === presetId);
          if (!p) return s;
          return patch(s, {
            colors: { primary: p.primary, secondary: p.secondary, accent: s.config.colors.accent === null ? null : p.accent },
          });
        }),
      toggleStat: (key) =>
        set((s) => {
          const on = s.config.stats.includes(key);
          if (on) return patch(s, { stats: s.config.stats.filter((k) => k !== key) });
          // Re-insert in canonical position relative to the other enabled stats.
          const next = [...s.config.stats, key];
          return patch(s, { stats: next });
        }),
      moveStat: (key, dir) =>
        set((s) => {
          const list = [...s.config.stats];
          const i = list.indexOf(key);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return s;
          [list[i], list[j]] = [list[j], list[i]];
          return patch(s, { stats: list });
        }),
      setAppearance: (p) => set((s) => patch(s, { appearance: { ...s.config.appearance, ...p } })),
      reset: () => set({ config: DEFAULT_CONFIG }),
    }),
    {
      name: "sigcard.draft.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ config: s.config, live: s.live, recent: s.recent, published: s.published, publishKey: s.publishKey }),
      // Never trust stored drafts: validate, fall back to defaults if the shape changed.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { config?: unknown; live?: unknown; recent?: unknown; published?: unknown; publishKey?: unknown };
        const published = publishedSchema.safeParse(p.published);
        const config = cardConfigSchema.safeParse(p.config);
        const live = playerResultSchema.safeParse(p.live);
        const recent = recentPlayerSchema.array().max(5).safeParse(p.recent);
        return {
          ...current,
          config: config.success ? config.data : current.config,
          live: live.success ? live.data : null,
          recent: recent.success ? recent.data : [],
          published: published.success ? (published.data as unknown as PublishedState) : null,
          publishKey: typeof p.publishKey === "string" ? p.publishKey : null,
        };
      },
      skipHydration: true,
    },
  ),
);

export const ALL_STATS = STAT_KEYS;
