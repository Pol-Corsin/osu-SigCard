import { describe, expect, it, vi } from "vitest";
import { OsuClient } from "@/modules/osu/client";
import { readOsuCredentials } from "@/modules/osu/config";
import { OsuApiError } from "@/modules/osu/errors";
import { KeyedLimiter } from "@/modules/osu/limiter";
import { normalizeUser } from "@/modules/osu/normalize";
import { TokenManager } from "@/modules/osu/token";
import { PlayerService } from "@/modules/player/service";

const creds = { clientId: "123", clientSecret: "shh" };

const user = (over: Record<string, unknown> = {}) => ({
  id: 2,
  username: "peppy",
  avatar_url: "https://a.ppy.sh/2?1.jpeg",
  country_code: "AU",
  country: { code: "AU", name: "Australia" },
  cover: { url: "https://assets.ppy.sh/user-profile-covers/2/x.jpeg" },
  user_achievements: [{}, {}, {}],
  statistics: {
    global_rank: 1234,
    country_rank: 56,
    pp: 4321.5,
    hit_accuracy: 97.123,
    play_count: 999,
    ranked_score: 123456789,
    level: { current: 100, progress: 42 },
  },
  ...over,
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const tokenRes = (token = "tok-1", expires = 86400) => json({ access_token: token, expires_in: expires, token_type: "Bearer" });

/** Fake osu! server: token endpoint + scripted API responses. */
function fakeOsu(apiResponses: (() => Response | Promise<Response>)[], tokens = ["tok-1", "tok-2", "tok-3"]) {
  let t = 0;
  let a = 0;
  const calls: { url: string; auth?: string }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ url, auth });
    if (url.endsWith("/oauth/token")) return tokenRes(tokens[t++]);
    const next = apiResponses[a++];
    if (!next) throw new Error(`unexpected API call ${url}`);
    return next();
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

describe("credentials", () => {
  it("are read only when both values are present and the id is numeric", () => {
    expect(readOsuCredentials({ OSU_CLIENT_ID: "1", OSU_CLIENT_SECRET: "x" } as unknown as NodeJS.ProcessEnv)).toEqual({ clientId: "1", clientSecret: "x" });
    expect(readOsuCredentials({ OSU_CLIENT_ID: "1" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(readOsuCredentials({ OSU_CLIENT_ID: "abc", OSU_CLIENT_SECRET: "x" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("normalizeUser", () => {
  it("maps the API shape to a snapshot", () => {
    const s = normalizeUser(user() as never, "taiko", new Date("2026-01-01T00:00:00Z"));
    expect(s).toMatchObject({
      id: 2,
      username: "peppy",
      countryCode: "AU",
      countryName: "Australia",
      mode: "taiko",
      avatarUrl: "https://a.ppy.sh/2?1.jpeg",
      coverUrl: "https://assets.ppy.sh/user-profile-covers/2/x.jpeg",
      stats: { globalRank: 1234, countryRank: 56, pp: 4321.5, accuracy: 97.123, playCount: 999, rankedScore: 123456789, level: { current: 100, progress: 42 }, medals: 3 },
      fetchedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("treats missing or zero ranks as unranked and fills missing stats", () => {
    const s = normalizeUser(user({ statistics: { global_rank: null, country_rank: 0 }, user_achievements: undefined }) as never, "mania");
    expect(s.stats.globalRank).toBeNull();
    expect(s.stats.countryRank).toBeNull();
    expect(s.stats.pp).toBe(0);
    expect(s.stats.level).toEqual({ current: 1, progress: 0 });
    expect(s.stats.medals).toBe(0);
  });

  it("drops images from hosts other than osu!", () => {
    const s = normalizeUser(user({ avatar_url: "https://evil.example/a.png", cover: { url: "http://assets.ppy.sh/x.jpg" } }) as never, "osu");
    expect(s.avatarUrl).toBeNull();
    expect(s.coverUrl).toBeNull();
  });
});

describe("TokenManager", () => {
  it("reuses the token and shares one request between concurrent callers", async () => {
    const osu = fakeOsu([]);
    const tm = new TokenManager(creds, osu.fetch);
    const [a, b] = await Promise.all([tm.get(), tm.get()]);
    expect(a).toBe("tok-1");
    expect(b).toBe("tok-1");
    expect(await tm.get()).toBe("tok-1");
    expect(osu.calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(1);
  });

  it("refreshes after 90% of the lifetime", async () => {
    let now = 0;
    const osu = fakeOsu([]);
    const tm = new TokenManager(creds, osu.fetch, () => now);
    expect(await tm.get()).toBe("tok-1");
    now = 86400 * 1000 * 0.91;
    expect(await tm.get()).toBe("tok-2");
  });

  it("reports rejected credentials as auth_failed", async () => {
    const fetchFn = vi.fn(async () => json({ error: "invalid_client" }, 401)) as unknown as typeof fetch;
    await expect(new TokenManager(creds, fetchFn).get()).rejects.toMatchObject({ code: "auth_failed" });
  });
});

describe("OsuClient", () => {
  it("looks up usernames with the @ prefix and sends the bearer token", async () => {
    const osu = fakeOsu([() => json(user())]);
    await new OsuClient(creds, osu.fetch).getUser({ username: "Some Name" }, "fruits");
    const api = osu.calls.find((c) => c.url.includes("/api/v2/"))!;
    expect(api.url).toBe("https://osu.ppy.sh/api/v2/users/%40Some%20Name/fruits");
    expect(api.auth).toBe("Bearer tok-1");
  });

  it("refreshes the token once on 401, then succeeds", async () => {
    const osu = fakeOsu([() => json({}, 401), () => json(user())]);
    const u = await new OsuClient(creds, osu.fetch).getUser({ id: 2 }, "osu");
    expect(u.username).toBe("peppy");
    const auths = osu.calls.filter((c) => c.url.includes("/api/v2/")).map((c) => c.auth);
    expect(auths).toEqual(["Bearer tok-1", "Bearer tok-2"]);
  });

  it.each([
    [404, {}, "not_found"],
    [429, { "retry-after": "12" }, "rate_limited"],
    [500, {}, "unavailable"],
    [502, {}, "unavailable"],
  ])("maps HTTP %i to %s", async (status, headers, code) => {
    const osu = fakeOsu([() => json({}, status, headers)]);
    const err = await new OsuClient(creds, osu.fetch).getUser({ id: 2 }, "osu").catch((e) => e);
    expect(err).toBeInstanceOf(OsuApiError);
    expect(err.code).toBe(code);
    if (status === 429) expect(err.retryAfterSeconds).toBe(12);
  });

  it("maps network failures to unavailable", async () => {
    const osu = fakeOsu([() => Promise.reject(new TypeError("fetch failed"))]);
    await expect(new OsuClient(creds, osu.fetch).getUser({ id: 2 }, "osu")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("rejects responses that don't look like a user", async () => {
    const osu = fakeOsu([() => json({ hello: "world" })]);
    await expect(new OsuClient(creds, osu.fetch).getUser({ id: 2 }, "osu")).rejects.toMatchObject({ code: "bad_response" });
  });

  it("throttles itself before osu! has to", async () => {
    const osu = fakeOsu([() => json(user()), () => json(user())]);
    const client = new OsuClient(creds, osu.fetch, { burst: 1, perMinute: 60, now: () => 0 });
    await client.getUser({ id: 2 }, "osu");
    await expect(client.getUser({ id: 2 }, "taiko")).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("PlayerService", () => {
  const make = (responses: (() => Response | Promise<Response>)[], now = () => Date.now()) => {
    const osu = fakeOsu(responses);
    const service = new PlayerService({ client: new OsuClient(creds, osu.fetch, { now }), freshMs: 1000, staleMs: 10_000, now });
    return { service, osu };
  };
  const apiCalls = (osu: ReturnType<typeof fakeOsu>) => osu.calls.filter((c) => c.url.includes("/api/v2/")).length;

  it("serves sample ids without calling osu!", async () => {
    const { service, osu } = make([]);
    const r = await service.byId(90000001, "osu");
    expect(r.source).toBe("sample");
    expect(r.player.isSample).toBe(true);
    expect(osu.calls).toHaveLength(0);
  });

  it("caches by id and username, case-insensitively", async () => {
    const { service, osu } = make([() => json(user())]);
    expect((await service.byUsername("PePPy", "osu")).source).toBe("api");
    expect((await service.byUsername("peppy", "osu")).source).toBe("cache");
    expect((await service.byId(2, "osu")).source).toBe("cache");
    expect(apiCalls(osu)).toBe(1);
  });

  it("coalesces concurrent lookups into one API call", async () => {
    const { service, osu } = make([() => json(user())]);
    const results = await Promise.all([service.byId(2, "osu"), service.byId(2, "osu"), service.byId(2, "osu")]);
    expect(results.every((r) => r.player.username === "peppy")).toBe(true);
    expect(apiCalls(osu)).toBe(1);
  });

  it("falls back to stale data when osu! is unavailable", async () => {
    let now = 0;
    const { service } = make([() => json(user()), () => json({}, 503)], () => now);
    await service.byId(2, "osu");
    now = 5000; // past fresh (1s), within stale (10s)
    const r = await service.byId(2, "osu");
    expect(r.source).toBe("stale");
    expect(r.warning).toMatch(/Showing data from/);
  });

  it("does not hide a deleted player behind stale data", async () => {
    let now = 0;
    const { service } = make([() => json(user()), () => json({}, 404)], () => now);
    await service.byId(2, "osu");
    now = 5000;
    await expect(service.byId(2, "osu")).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects invalid usernames without calling osu!", async () => {
    const { service, osu } = make([]);
    await expect(service.byUsername("../../oauth", "osu")).rejects.toMatchObject({ code: "invalid_username" });
    expect(osu.calls).toHaveLength(0);
  });

  it("without credentials: samples work, live lookups explain why they can't", async () => {
    const service = new PlayerService({ client: null });
    expect((await service.byUsername("kairo_", "osu")).source).toBe("sample");
    await expect(service.byUsername("peppy", "osu")).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("KeyedLimiter", () => {
  it("limits each key independently", () => {
    const now = 0;
    const l = new KeyedLimiter(2, 1, 100, () => now);
    expect(l.take("a")).toBe(0);
    expect(l.take("a")).toBe(0);
    expect(l.take("a")).toBeGreaterThan(0);
    expect(l.take("b")).toBe(0);
  });
});
