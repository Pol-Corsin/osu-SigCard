"use client";
/** Browser-side calls to our own /api routes. Never talks to osu! directly. */
import type { ApiErrorBody, PlayerResult } from "@/modules/player/service-types";
import { playerResultSchema } from "@/modules/player/schema";
import type { GameMode } from "@/modules/player/types";

export class PlayerLookupError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
  }
}

export async function fetchPlayer(
  q: { username: string } | { id: number },
  mode: GameMode,
  signal?: AbortSignal,
): Promise<PlayerResult> {
  const params = new URLSearchParams({ mode, ...("id" in q ? { id: String(q.id) } : { username: q.username }) });
  let res: Response;
  try {
    res = await fetch(`/api/player?${params}`, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new PlayerLookupError("network", "You appear to be offline. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new PlayerLookupError(err?.code ?? "unknown", err?.message ?? "Couldn't load that player. Try again.", err?.retryAfter ?? null);
  }
  const parsed = playerResultSchema.safeParse(body);
  if (!parsed.success) throw new PlayerLookupError("bad_response", "Got an unexpected response. Try again.");
  return parsed.data;
}

let statusPromise: Promise<boolean> | null = null;
/** Whether live osu! lookups are configured on the server (cached per page load). */
export function fetchApiStatus(): Promise<boolean> {
  statusPromise ??= fetch("/api/status")
    .then((r) => r.json())
    .then((b: { osuApi?: boolean }) => b.osuApi === true)
    .catch(() => false);
  return statusPromise;
}
