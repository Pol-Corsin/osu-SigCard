/**
 * osu! API v2 client (server-only). Handles auth, timeouts, a single token
 * refresh on 401, osu!'s 429 responses, our own outgoing rate limit, and
 * response validation. Every failure surfaces as an OsuApiError.
 */
import type { GameMode } from "../player/types";
import { OSU_API, type OsuCredentials } from "./config";
import { OsuApiError } from "./errors";
import { TokenBucket } from "./limiter";
import { osuUserSchema, type OsuUser } from "./schemas";
import { retryAfter, TokenManager } from "./token";

export type UserRef = { id: number } | { username: string };

/** osu! usernames: letters, digits, spaces, - _ [ ]. Old accounts can be short; keep a generous upper bound. */
export const USERNAME_RE = /^[A-Za-z0-9 _\-\[\]]{1,32}$/;

export class OsuClient {
  private readonly tokens: TokenManager;
  private readonly outgoing: TokenBucket;

  constructor(
    creds: OsuCredentials,
    private readonly fetchFn: typeof fetch = fetch,
    opts: { perMinute?: number; burst?: number; now?: () => number } = {},
  ) {
    this.tokens = new TokenManager(creds, fetchFn, opts.now);
    this.outgoing = new TokenBucket(opts.burst ?? 20, (opts.perMinute ?? 60) / 60, opts.now);
  }

  async getUser(ref: UserRef, mode: GameMode): Promise<OsuUser> {
    const key = "id" in ref ? String(ref.id) : `@${ref.username}`;
    return this.get(`/users/${encodeURIComponent(key)}/${mode}`, (json) => {
      const parsed = osuUserSchema.safeParse(json);
      if (!parsed.success) throw new OsuApiError("bad_response", "osu! returned player data in an unexpected format.");
      return parsed.data;
    });
  }

  private async get<T>(path: string, parse: (json: unknown) => T, retried = false): Promise<T> {
    const wait = this.outgoing.take();
    if (wait > 0) {
      throw new OsuApiError("rate_limited", "Lots of lookups right now. Try again in a few seconds.", wait);
    }
    const token = await this.tokens.get();
    let res: Response;
    try {
      res = await this.fetchFn(`${OSU_API}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new OsuApiError("unavailable", "Couldn't reach osu!. Check back in a moment.");
    }

    if (res.status === 401 && !retried) {
      this.tokens.invalidate(token);
      return this.get(path, parse, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new OsuApiError("auth_failed", "The server's osu! API credentials were rejected.");
    }
    if (res.status === 404) throw new OsuApiError("not_found", "No osu! player with that name or ID.");
    if (res.status === 429) {
      throw new OsuApiError("rate_limited", "osu! is rate limiting requests. Try again shortly.", retryAfter(res) ?? 30);
    }
    if (!res.ok) throw new OsuApiError("unavailable", "osu! is having trouble right now. Try again in a moment.");

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new OsuApiError("bad_response", "osu! returned an unreadable response.");
    }
    return parse(json);
  }
}
