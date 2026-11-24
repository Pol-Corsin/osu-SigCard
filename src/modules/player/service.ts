/**
 * Player service — the only way the app gets player data.
 *
 * Resolution order for a lookup:
 *   1. sample player ids          → bundled fictional fixtures (always work)
 *   2. fresh cache hit            → no osu! call
 *   3. osu! API                   → cached, coalesced per key
 *   4. osu! failed + stale cache  → stale snapshot with a warning
 *   5. otherwise                  → OsuApiError (route maps it to a message)
 */
import { readOsuCredentials } from "../osu/config";
import { OsuClient, USERNAME_RE, type UserRef } from "../osu/client";
import { OsuApiError } from "../osu/errors";
import { normalizeUser } from "../osu/normalize";
import { SAMPLE_PROFILES, sampleSnapshot } from "./fixtures";
import { TtlCache } from "./cache";
import type { GameMode, PlayerSnapshot } from "./types";

import type { PlayerResult } from "./service-types";
export type { PlayerResult, PlayerSource } from "./service-types";

const MINUTE = 60_000;

export type PlayerServiceOptions = {
  client: OsuClient | null;
  freshMs?: number;
  staleMs?: number;
  now?: () => number;
};

export class PlayerService {
  private snapshots: TtlCache<PlayerSnapshot>;
  private usernames: TtlCache<number>; // lowercase username → id
  private inflight = new Map<string, Promise<PlayerSnapshot>>();
  private readonly client: OsuClient | null;

  constructor(opts: PlayerServiceOptions) {
    this.client = opts.client;
    const fresh = opts.freshMs ?? 30 * MINUTE;
    const stale = opts.staleMs ?? 24 * 60 * MINUTE;
    this.snapshots = new TtlCache(fresh, stale, 2000, opts.now);
    this.usernames = new TtlCache(fresh, stale, 5000, opts.now);
  }

  get apiConfigured() {
    return this.client !== null;
  }

  async byId(id: number, mode: GameMode): Promise<PlayerResult> {
    if (SAMPLE_PROFILES.some((p) => p.id === id)) return { player: sampleSnapshot(id, mode), source: "sample" };
    return this.resolve(`${id}:${mode}`, { id }, mode);
  }

  async byUsername(raw: string, mode: GameMode): Promise<PlayerResult> {
    const username = raw.trim().replace(/\s+/g, " ");
    if (!USERNAME_RE.test(username)) {
      throw new OsuApiError("invalid_username", "osu! usernames only use letters, numbers, spaces, - _ [ ].");
    }
    const sample = SAMPLE_PROFILES.find((p) => p.username.toLowerCase() === username.toLowerCase());
    if (sample && !this.client) return { player: sampleSnapshot(sample.id, mode), source: "sample" };

    const knownId = this.usernames.get(username.toLowerCase());
    if (knownId) return this.resolve(`${knownId.value}:${mode}`, { id: knownId.value }, mode);
    return this.resolve(`@${username.toLowerCase()}:${mode}`, { username }, mode);
  }

  private async resolve(key: string, ref: UserRef, mode: GameMode): Promise<PlayerResult> {
    const cached = this.snapshots.get(key);
    if (cached?.fresh) return { player: cached.value, source: "cache" };

    if (!this.client) {
      if (cached) return { player: cached.value, source: "stale", warning: notConfigured };
      throw new OsuApiError("not_configured", "Live osu! lookups aren't set up on this server yet. Sample players still work.");
    }

    try {
      const player = await this.fetchCoalesced(key, ref, mode);
      return { player, source: "api" };
    } catch (err) {
      const e = err instanceof OsuApiError ? err : new OsuApiError("unavailable", "Couldn't load that player right now.");
      // Never paper over "this player doesn't exist" with old data.
      if (cached && e.code !== "not_found") {
        return { player: cached.value, source: "stale", warning: `${e.message} Showing data from ${ago(cached.storedAt)}.` };
      }
      throw e;
    }
  }

  private fetchCoalesced(key: string, ref: UserRef, mode: GameMode): Promise<PlayerSnapshot> {
    let p = this.inflight.get(key);
    if (!p) {
      p = this.client!
        .getUser(ref, mode)
        .then((user) => {
          const snap = normalizeUser(user, mode);
          // Store under the canonical id key too, so id and username lookups share the cache.
          this.snapshots.set(`${snap.id}:${mode}`, snap);
          this.snapshots.set(key, snap);
          this.usernames.set(snap.username.toLowerCase(), snap.id);
          return snap;
        })
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }
}

const notConfigured = "Live osu! lookups aren't set up on this server. Showing cached data.";

function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / MINUTE);
  if (m < 1) return "less than a minute ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

// ---- process-wide singleton ----
let instance: PlayerService | null = null;

export function getPlayerService(): PlayerService {
  if (!instance) {
    const creds = readOsuCredentials();
    instance = new PlayerService({ client: creds ? new OsuClient(creds) : null });
  }
  return instance;
}
