/**
 * HTTP-level tests: the real route handlers, called with Request objects,
 * backed by PGlite + an in-memory image store.
 */
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as publish } from "@/app/api/cards/route";
import { GET as getCard, PATCH as patchCard } from "@/app/api/cards/[id]/route";
import { POST as rotate } from "@/app/api/cards/[id]/token/route";
import { GET as image } from "@/app/c/[file]/route";
import { GET as qr } from "@/app/api/qr/route";
import type { PublishResponse } from "@/modules/cards/api-types";
import { DEFAULT_CONFIG } from "@/modules/cards/config";
import { CardService, type PlayerSource } from "@/modules/cards/service";
import { migrate, pgliteDb, setDbForTests } from "@/modules/db/client";
import { OsuApiError } from "@/modules/osu/errors";
import { NextRequest } from "next/server";
import { MISSING_CARD_PATH, proxy } from "@/proxy";
import { baseUrl } from "@/modules/server/baseUrl";
import { setCardServiceForTests } from "@/modules/server/context";
import { memoryStore } from "@/modules/storage/images";

const BASE = "http://localhost:3000";
const players: PlayerSource = {
  async byId(id, mode) {
    if (id !== 2) throw new OsuApiError("not_found", "No osu! player with that name or ID.");
    return {
      source: "api",
      player: {
        id: 2, username: "peppy", countryCode: "AU", countryName: "Australia", avatarUrl: null, coverUrl: null, mode,
        stats: { globalRank: 1, countryRank: 1, pp: 1000, accuracy: 99, playCount: 1, level: { current: 1, progress: 0 }, rankedScore: 1, medals: 1 },
        fetchedAt: new Date().toISOString(),
      },
    };
  },
};

const json = (url: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${url}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers } });
const ctx = <T>(p: T) => ({ params: Promise.resolve(p) });
const publishBody = () => ({ config: { ...DEFAULT_CONFIG, player: { id: 2, mode: "osu" } }, publishKey: `k-${crypto.randomUUID()}` });

let published: PublishResponse;

beforeAll(async () => {
  const db = pgliteDb(new PGlite());
  await migrate(db);
  setDbForTests(db);
  setCardServiceForTests(new CardService({ db, store: memoryStore(), players }));
  const res = await publish(json("/api/cards", "POST", publishBody()));
  expect(res.status).toBe(201);
  published = (await res.json()) as PublishResponse;
});
afterAll(() => {
  setCardServiceForTests(null);
  setDbForTests(null);
});

describe("POST /api/cards", () => {
  it("returns links, BBCode and an edit URL with the token in the fragment", () => {
    const { card, editUrl, editToken } = published;
    expect(card.links.image).toBe(`${BASE}/c/${card.publicId}.png`);
    expect(card.links.page).toBe(`${BASE}/card/${card.publicId}`);
    expect(card.links.bbcode).toBe(`[url=https://osu.ppy.sh/users/2][img]${BASE}/c/${card.publicId}.png[/img][/url]`);
    expect(editUrl).toBe(`${BASE}/edit/${card.publicId}#${editToken}`);
    expect(JSON.stringify(card)).not.toContain(editToken);
  });

  it("rejects oversized bodies, invalid JSON and missing keys", async () => {
    const big = new Request(`${BASE}/api/cards`, { method: "POST", body: "x".repeat(20_000), headers: { "x-forwarded-for": "203.0.113.8" } });
    expect((await publish(big)).status).toBe(413);
    const bad = new Request(`${BASE}/api/cards`, { method: "POST", body: "{nope", headers: { "x-forwarded-for": "203.0.113.8" } });
    expect((await publish(bad)).status).toBe(400);
    expect((await publish(json("/api/cards", "POST", { config: {} }))).status).toBe(400);
  });

  it("rate limits publishing per client", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await publish(json("/api/cards", "POST", publishBody(), { "x-forwarded-for": "198.51.100.1" }))).status;
    expect(last).toBe(429);
  });
});

describe("GET /c/{id}.png", () => {
  it("serves the PNG with an ETag and supports conditional requests", async () => {
    const id = published.card.publicId;
    const res = await image(new Request(`${BASE}/c/${id}.png`), ctx({ file: `${id}.png` }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const etag = res.headers.get("etag")!;
    expect(etag).toBe(`"${published.card.imageEtag}"`);
    expect(Buffer.from(await res.arrayBuffer()).subarray(1, 4).toString()).toBe("PNG");
    const again = await image(new Request(`${BASE}/c/${id}.png`, { headers: { "if-none-match": etag } }), ctx({ file: `${id}.png` }));
    expect(again.status).toBe(304);
    const dl = await image(new Request(`${BASE}/c/${id}.png?download=1`), ctx({ file: `${id}.png` }));
    expect(dl.headers.get("content-disposition")).toMatch(/attachment; filename="peppy-/);
  });

  it("404s unknown and malformed IDs", async () => {
    expect((await image(new Request(`${BASE}/c/AAAAAAAAAA.png`), ctx({ file: "AAAAAAAAAA.png" }))).status).toBe(404);
    expect((await image(new Request(`${BASE}/c/x.png`), ctx({ file: "../etc.png" }))).status).toBe(404);
  });
});

describe("owner endpoints", () => {
  const auth = () => ({ authorization: `Bearer ${published.editToken}` });

  it("require the edit token", async () => {
    const id = published.card.publicId;
    const res = await getCard(new Request(`${BASE}/api/cards/${id}`), ctx({ id }));
    expect(res.status).toBe(401);
    const wrong = await getCard(new Request(`${BASE}/api/cards/${id}`, { headers: { authorization: `Bearer ${"x".repeat(43)}` } }), ctx({ id }));
    expect(wrong.status).toBe(401);
    const ok = await getCard(new Request(`${BASE}/api/cards/${id}`, { headers: auth() }), ctx({ id }));
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { card: { config: { template: string } } }).card.config.template).toBe("playerCard");
  });

  it("PATCH updates the design and keeps the image URL", async () => {
    const id = published.card.publicId;
    const res = await patchCard(json(`/api/cards/${id}`, "PATCH", { config: { ...DEFAULT_CONFIG, template: "artistic", player: { id: 2, mode: "osu" } }, baseVersion: 1 }, auth()), ctx({ id }));
    expect(res.status).toBe(200);
    const { card } = (await res.json()) as PublishResponse;
    expect(card.links.image).toBe(published.card.links.image);
    expect(card.config.template).toBe("artistic");
    expect(card.imageEtag).not.toBe(published.card.imageEtag);
    const unauthorized = await patchCard(json(`/api/cards/${id}`, "PATCH", { config: DEFAULT_CONFIG }), ctx({ id }));
    expect(unauthorized.status).toBe(401);
  });

  it("token reset returns a new edit URL and revokes the old token", async () => {
    const id = published.card.publicId;
    const res = await rotate(json(`/api/cards/${id}/token`, "POST", {}, auth()), ctx({ id }));
    expect(res.status).toBe(200);
    const { editToken, editUrl } = (await res.json()) as { editToken: string; editUrl: string };
    expect(editUrl).toBe(`${BASE}/edit/${id}#${editToken}`);
    expect((await getCard(new Request(`${BASE}/api/cards/${id}`, { headers: auth() }), ctx({ id }))).status).toBe(401);
    published = { ...published, editToken };
    expect((await getCard(new Request(`${BASE}/api/cards/${id}`, { headers: auth() }), ctx({ id }))).status).toBe(200);
  });
});

describe("GET /api/qr", () => {
  it("encodes only card pages and osu! profiles", async () => {
    const card = await qr(new Request(`${BASE}/api/qr?kind=card&id=AbCdEfGhIj&format=png&download=1`));
    expect(card.headers.get("content-type")).toBe("image/png");
    expect(card.headers.get("x-qr-content")).toBe(`${BASE}/card/AbCdEfGhIj`);
    expect(card.headers.get("content-disposition")).toMatch(/card-AbCdEfGhIj-qr\.png/);
    const profile = await qr(new Request(`${BASE}/api/qr?kind=profile&user=2`));
    expect(profile.headers.get("content-type")).toBe("image/svg+xml");
    expect(profile.headers.get("x-qr-content")).toBe("https://osu.ppy.sh/users/2");
    expect((await qr(new Request(`${BASE}/api/qr?kind=url&data=https://evil.example`))).status).toBe(400);
  });
});

describe("public base URL", () => {
  const ENV = ["PUBLIC_BASE_URL", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;
  const withEnv = (vars: Partial<Record<(typeof ENV)[number], string>>, fn: () => void) => {
    for (const k of ENV) vi.stubEnv(k, vars[k] ?? "");
    try {
      fn();
    } finally {
      vi.unstubAllEnvs();
    }
  };
  const req = new Request("http://localhost:3000/api/cards");
  const vercel = { VERCEL: "1", VERCEL_URL: "sigcard-abc123-me.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "sig.example.com" };

  it("uses the request origin locally", () => withEnv({}, () => expect(baseUrl(req)).toBe("http://localhost:3000")));

  it("PUBLIC_BASE_URL wins everywhere (trailing slash removed)", () =>
    withEnv({ ...vercel, VERCEL_ENV: "preview", PUBLIC_BASE_URL: "https://cards.example/" }, () => expect(baseUrl(req)).toBe("https://cards.example")));

  it("previews link to their own deployment, never the production domain", () =>
    withEnv({ ...vercel, VERCEL_ENV: "preview" }, () => expect(baseUrl(req)).toBe("https://sigcard-abc123-me.vercel.app")));

  it("production falls back to the production domain", () =>
    withEnv({ ...vercel, VERCEL_ENV: "production" }, () => expect(baseUrl(req)).toBe("https://sig.example.com")));

  it("a hosted deployment with nothing to go on refuses instead of guessing", () =>
    withEnv({ VERCEL: "1", VERCEL_ENV: "production" }, () => expect(() => baseUrl(req)).toThrow(/PUBLIC_BASE_URL/)));
});

describe("GET /card/{id} status (proxy)", () => {
  const visit = (id: string) => proxy(new NextRequest(`${BASE}/card/${id}`));

  it("passes existing cards through to the page", async () => {
    const res = await visit(published.card.publicId);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("routes unknown and malformed IDs to the 404 page", async () => {
    for (const id of ["ZZZZZZZZZZ", "short", "not-an-id!"]) {
      const res = await visit(id);
      expect(new URL(res.headers.get("x-middleware-rewrite")!).pathname).toBe(MISSING_CARD_PATH);
    }
  });
});
