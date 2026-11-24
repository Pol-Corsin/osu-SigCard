/** Client-safe types shared with the player service (no server imports). */
import type { PlayerSnapshot } from "./types";

export type PlayerSource = "api" | "cache" | "stale" | "sample";
export type PlayerResult = { player: PlayerSnapshot; source: PlayerSource; warning?: string };

export type ApiErrorBody = { error: { code: string; message: string; retryAfter: number | null } };
