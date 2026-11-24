/**
 * OAuth client-credentials token manager.
 *
 * - One token per server instance, reused until ~90% of its lifetime.
 * - Concurrent callers share a single in-flight token request (no stampede).
 * - invalidate() forces a refresh after osu! rejects a token (401).
 */
import { OSU_BASE, type OsuCredentials } from "./config";
import { OsuApiError } from "./errors";

type Token = { value: string; expiresAt: number };
type FetchFn = typeof fetch;

export class TokenManager {
  private token: Token | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly creds: OsuCredentials,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) return this.token.value;
    if (!this.inflight) {
      this.inflight = this.request().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  invalidate(value?: string) {
    if (!value || this.token?.value === value) this.token = null;
  }

  private async request(): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchFn(`${OSU_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: Number(this.creds.clientId),
          client_secret: this.creds.clientSecret,
          grant_type: "client_credentials",
          scope: "public",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new OsuApiError("unavailable", "Couldn't reach osu! to sign in. Try again in a moment.");
    }
    if (res.status === 400 || res.status === 401) {
      throw new OsuApiError("auth_failed", "The server's osu! API credentials were rejected.");
    }
    if (res.status === 429) {
      throw new OsuApiError("rate_limited", "osu! is rate limiting requests. Try again shortly.", retryAfter(res));
    }
    if (!res.ok) throw new OsuApiError("unavailable", "osu! sign-in is temporarily unavailable.");

    const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!body?.access_token || typeof body.expires_in !== "number") {
      throw new OsuApiError("bad_response", "osu! returned an unexpected sign-in response.");
    }
    this.token = { value: body.access_token, expiresAt: this.now() + body.expires_in * 1000 * 0.9 };
    return body.access_token;
  }
}

export function retryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(1, Math.ceil(n));
  const date = Date.parse(h);
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - Date.now()) / 1000)) : undefined;
}
