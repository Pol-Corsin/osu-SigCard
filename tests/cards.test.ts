/**
 * Publishing, persistence, editing and refresh against a real Postgres
 * (PGlite, same SQL and migrations as Neon) and an in-memory image store.
 */
import { PGlite } from "@electric-sql/pglite";
import jsQR from "jsqr";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type CardConfig } from "@/modules/cards/config";
import { CardError, CardService, type PlayerSource } from "@/modules/cards/service";
import { migrate, pgliteDb, type Db } from "@/modules/db/client";
import { OsuApiError } from "@/modules/osu/errors";
import type { PlayerSnapshot } from "@/modules/player/types";
import { optimizePng } from "@/modules/render/optimize";
import { rateLimit, RULES } from "@/modules/security/rateLimit";
import { EDIT_TOKEN_RE, hashEditToken, PUBLIC_ID_RE } from "@/modules/security/tokens";
import { bbcode, cardLinks, editLink } from "@/modules/share/links";
import { qrPng } from "@/modules/share/qr";
import { memoryStore } from "@/modules/storage/images";

const PEPPY = 2;

function snapshot(mode: PlayerSnapshot["mode"], pp: number): PlayerSnapshot {
  return {
    id: PEPPY,
    username: "peppy",
    countryCode: "AU",
    countryName: "Australia",
    avatarUrl: null, // keep tests offline
    coverUrl: null,
    mode,
    stats: { globalRank: 1234, countryRank: 56, pp, accuracy: 97.5, playCount: 1000, level: { current: 100, progress: 40 }, rankedScore: 1e9, medals: 10 },
    fetchedAt: clock.toISOString(),
  };
}

/** Controllable stand-in for the osu! player service. */
class FakePlayers implements PlayerSource {
  pp = 4000;
  calls = 0;
  fail: OsuApiError | null = null;
  lastFresh: boolean | undefined;
  async byId(id: number, mode: PlayerSnapshot["mode"], opts?: { fresh?: boolean }) {
    this.calls++;
    this.lastFresh = opts?.fresh;
    if (this.fail) throw this.fail;
    if (id !== PEPPY) throw new OsuApiError("not_found", "No osu! player with that name or ID.");
    return { player: snapshot(mode, this.pp), source: "api" as const };
  }
}

const config = (patch: Partial<CardConfig> = {}): CardConfig => ({ ...DEFAULT_CONFIG, player: { id: PEPPY, mode: "osu" }, ...patch });
const key = () => `k-${crypto.randomUUID()}`;

let db: Db;
let store: ReturnType<typeof memoryStore>;
let players: FakePlayers;
let service: CardService;
let clock: Date;

beforeEach(async () => {
  db = pgliteDb(new PGlite());
  await migrate(db);
  store = memoryStore();
  players = new FakePlayers();
  clock = new Date("2026-11-24T12:00:00Z");
  service = new CardService({ db, store, players, now: () => clock, autoRefreshMs: 12 * 3600_000 });
});

const rowCount = async () => Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM cards`))[0].n);

describe("publishing", () => {
  it("persists the card, stores one PNG and returns a working edit token", async () => {
    const { card, editToken, created } = await service.publish({ config: config(), publishKey: key() });
    expect(created).toBe(true);
    expect(card.publicId).toMatch(PUBLIC_ID_RE);
    expect(editToken).toMatch(EDIT_TOKEN_RE);
    expect(card).toMatchObject({ osuUserId: PEPPY, username: "peppy", mode: "osu", template: "playerCard", width: 900, height: 300, version: 1 });
    expect(await rowCount()).toBe(1);
    expect(store.objects.size).toBe(1);

    const img = await service.getImage(card.publicId);
    expect(img?.png.subarray(1, 4).toString()).toBe("PNG");
    expect((await sharp(img!.png).metadata()).width).toBe(900);

    const edit = await service.getForEdit(card.publicId, editToken);
    expect(edit.config.template).toBe("playerCard");
  });

  it("stores only a hash of the edit token, never the token, and exposes neither publicly", async () => {
    const { card, editToken } = await service.publish({ config: config(), publishKey: key() });
    const raw = JSON.stringify(await db.query(`SELECT * FROM cards`));
    expect(raw).not.toContain(editToken);
    expect(raw).toContain(hashEditToken(editToken));
    const pub = JSON.stringify(await service.getPublic(card.publicId));
    expect(pub).not.toContain(editToken);
    expect(pub).not.toContain(hashEditToken(editToken));
    expect(pub).not.toMatch(/edit_token|publish_key|image_key/);
  });

  it("is idempotent: retrying with the same key returns the same card and edit token", async () => {
    const k = key();
    const a = await service.publish({ config: config(), publishKey: k });
    const b = await service.publish({ config: config(), publishKey: k });
    expect(b.created).toBe(false);
    expect(b.card.publicId).toBe(a.card.publicId);
    expect(b.editToken).toBe(a.editToken);
    expect(await rowCount()).toBe(1);
    expect(store.objects.size).toBe(1);
  });

  it("handles concurrent duplicate publishes without duplicate rows or orphaned images", async () => {
    const k = key();
    const results = await Promise.all([1, 2, 3].map(() => service.publish({ config: config(), publishKey: k })));
    expect(new Set(results.map((r) => r.card.publicId)).size).toBe(1);
    expect(new Set(results.map((r) => r.editToken)).size).toBe(1);
    expect(await rowCount()).toBe(1);
    expect(store.objects.size).toBe(1);
  });

  it("different keys create different cards with different public IDs", async () => {
    const a = await service.publish({ config: config(), publishKey: key() });
    const b = await service.publish({ config: config(), publishKey: key() });
    expect(a.card.publicId).not.toBe(b.card.publicId);
    expect(a.editToken).not.toBe(b.editToken);
  });

  it("rejects sample players, invalid configs and bad keys", async () => {
    await expect(service.publish({ config: { ...config(), player: { id: 90000001, mode: "osu" } }, publishKey: key() })).rejects.toMatchObject({ code: "sample_player" });
    await expect(service.publish({ config: { ...config(), template: "nope" }, publishKey: key() })).rejects.toMatchObject({ code: "invalid_config" });
    await expect(service.publish({ config: { ...config(), colors: { primary: "red" } }, publishKey: key() })).rejects.toMatchObject({ code: "invalid_config" });
    await expect(service.publish({ config: config(), publishKey: "short" })).rejects.toMatchObject({ code: "invalid_config" });
    expect(await rowCount()).toBe(0);
    expect(store.objects.size).toBe(0);
  });

  it("propagates osu! errors (unknown player) without writing anything", async () => {
    await expect(service.publish({ config: { ...config(), player: { id: 999, mode: "osu" } }, publishKey: key() })).rejects.toBeInstanceOf(OsuApiError);
    expect(await rowCount()).toBe(0);
    expect(store.objects.size).toBe(0);
  });

  it("leaves no database row when the image upload fails", async () => {
    store.failNextPut = true;
    await expect(service.publish({ config: config(), publishKey: key() })).rejects.toThrow(/storage failure/);
    expect(await rowCount()).toBe(0);
  });

  it("deletes the uploaded image when the database insert fails", async () => {
    const failing: Db = { kind: "pglite", query: async (text, params) => (/^\s*INSERT INTO cards/.test(text) ? Promise.reject(new Error("db down")) : db.query(text, params)) };
    const s = new CardService({ db: failing, store, players });
    await expect(s.publish({ config: config(), publishKey: key() })).rejects.toThrow(/db down/);
    expect(store.objects.size).toBe(0);
  });

  it("normalises unknown variants and unsupported sizes to template defaults", async () => {
    const { card } = await service.publish({ config: config({ template: "editorial", variant: "bogus" }), publishKey: key() });
    expect(card.variant).toBe("washi");
  });
});

describe("editing", () => {
  it("rejects missing, malformed and wrong tokens with the same error", async () => {
    const { card } = await service.publish({ config: config(), publishKey: key() });
    for (const t of [null, "", "x", "A".repeat(43), "not a token at all"]) {
      await expect(service.getForEdit(card.publicId, t)).rejects.toMatchObject({ code: "unauthorized" });
    }
    await expect(service.getForEdit("ZZZZZZZZZZ", "A".repeat(43))).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.update(card.publicId, "A".repeat(43), { config: config({ template: "y2k" }) })).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("updates design in place: same public ID, new image, old image deleted, version bumped", async () => {
    const { card, editToken } = await service.publish({ config: config(), publishKey: key() });
    const before = await service.getImage(card.publicId);
    const updated = await service.update(card.publicId, editToken, { config: config({ template: "editorial", colors: { primary: "#e5383b", secondary: "#2f6f5e", accent: null } }), baseVersion: 1 });
    expect(updated.publicId).toBe(card.publicId);
    expect(updated.template).toBe("editorial");
    expect(updated.version).toBe(2);
    expect(updated.imageEtag).not.toBe(before!.etag);
    expect(store.objects.size).toBe(1); // old object removed
    const after = await service.getImage(card.publicId);
    expect(after!.etag).toBe(updated.imageEtag);
    expect(players.calls).toBe(1); // same mode: stats not refetched
  });

  it("fetches new stats only when the mode changes", async () => {
    const { card, editToken } = await service.publish({ config: config(), publishKey: key() });
    const updated = await service.update(card.publicId, editToken, { config: config({ player: { id: PEPPY, mode: "mania" } }) });
    expect(updated.mode).toBe("mania");
    expect(updated.player.mode).toBe("mania");
    expect(players.calls).toBe(2);
  });

  it("refuses to move a card to a different player", async () => {
    const { card, editToken } = await service.publish({ config: config(), publishKey: key() });
    await expect(service.update(card.publicId, editToken, { config: config({ player: { id: 3, mode: "osu" } }) })).rejects.toMatchObject({ code: "player_mismatch" });
  });

  it("detects stale edits and cleans up the image it uploaded", async () => {
    const { card, editToken } = await service.publish({ config: config(), publishKey: key() });
    await service.update(card.publicId, editToken, { config: config({ template: "minimal" }), baseVersion: 1 });
    await expect(service.update(card.publicId, editToken, { config: config({ template: "y2k" }), baseVersion: 1 })).rejects.toMatchObject({ code: "conflict" });
    expect(store.objects.size).toBe(1);
    expect((await service.getPublic(card.publicId))!.template).toBe("minimal");
  });

  it("resetting the edit link revokes the old token", async () => {
    const k = key();
    const { card, editToken } = await service.publish({ config: config(), publishKey: k });
    const next = await service.rotateToken(card.publicId, editToken);
    expect(next).toMatch(EDIT_TOKEN_RE);
    await expect(service.getForEdit(card.publicId, editToken)).rejects.toMatchObject({ code: "unauthorized" });
    expect((await service.getForEdit(card.publicId, next)).publicId).toBe(card.publicId);
    // A late retry of the original publish must not resurrect the revoked token.
    await expect(service.publish({ config: config(), publishKey: k })).rejects.toMatchObject({ code: "token_rotated" });
  });
});

describe("statistics refresh", () => {
  it("owner refresh re-fetches stats, regenerates the PNG and keeps design and URL", async () => {
    const { card, editToken } = await service.publish({ config: config({ template: "cyberpunk" }), publishKey: key() });
    players.pp = 9999;
    clock = new Date("2026-11-24T13:00:00Z");
    const { card: refreshed, refreshed: did } = await service.refresh(card.publicId, { token: editToken });
    expect(did).toBe(true);
    expect(refreshed.publicId).toBe(card.publicId);
    expect(refreshed.player.stats.pp).toBe(9999);
    expect(refreshed.imageEtag).not.toBe(card.imageEtag);
    expect(refreshed.template).toBe("cyberpunk");
    expect(players.lastFresh).toBe(true); // refreshes bypass the player cache
    expect(store.objects.size).toBe(1);
  });

  it("owner refresh surfaces osu! errors and leaves the card unchanged", async () => {
    const { card, editToken } = await service.publish({ config: config(), publishKey: key() });
    players.fail = new OsuApiError("rate_limited", "osu! is rate limiting requests.", 30);
    await expect(service.refresh(card.publicId, { token: editToken })).rejects.toMatchObject({ code: "rate_limited" });
    const owner = await service.getForEdit(card.publicId, editToken);
    expect(owner.imageEtag).toBe(card.imageEtag);
    expect(owner.refreshError).toMatch(/rate limiting/);
  });

  it("automatic refresh does nothing while stats are fresh", async () => {
    const { card } = await service.publish({ config: config(), publishKey: key() });
    const before = players.calls;
    const r = await service.refresh(card.publicId, { automatic: true });
    expect(r.refreshed).toBe(false);
    expect(players.calls).toBe(before);
  });

  it("automatic refresh runs once when stale, even under concurrent image requests", async () => {
    const { card } = await service.publish({ config: config(), publishKey: key() });
    players.pp = 5000;
    clock = new Date(clock.getTime() + 13 * 3600_000);
    const before = players.calls;
    const results = await Promise.all([1, 2, 3, 4].map(() => service.refresh(card.publicId, { automatic: true })));
    expect(results.filter((r) => r.refreshed)).toHaveLength(1);
    expect(players.calls - before).toBe(1);
    expect((await service.getPublic(card.publicId))!.player.stats.pp).toBe(5000);
  });

  it("automatic refresh failures are recorded, not thrown", async () => {
    const { card } = await service.publish({ config: config(), publishKey: key() });
    clock = new Date(clock.getTime() + 13 * 3600_000);
    players.fail = new OsuApiError("unavailable", "osu! is having trouble right now.");
    const r = await service.refresh(card.publicId, { automatic: true });
    expect(r.refreshed).toBe(false);
    expect(r.error).toMatch(/trouble/);
  });
});

describe("public links, BBCode and QR codes", () => {
  it("builds stable URLs and exact osu! BBCode", () => {
    const l = cardLinks("https://sig.example/", "AbCdEfGhIj", 2);
    expect(l).toEqual({ page: "https://sig.example/card/AbCdEfGhIj", image: "https://sig.example/c/AbCdEfGhIj.png", profile: "https://osu.ppy.sh/users/2" });
    expect(bbcode(l.profile, l.image)).toBe("[url=https://osu.ppy.sh/users/2][img]https://sig.example/c/AbCdEfGhIj.png[/img][/url]");
    expect(editLink("https://sig.example", "AbCdEfGhIj", "T".repeat(43))).toBe(`https://sig.example/edit/AbCdEfGhIj#${"T".repeat(43)}`);
  });

  it.each(["https://sig.example/card/AbCdEfGhIj", "https://osu.ppy.sh/users/2"])("QR code decodes to %s", async (url) => {
    const png = await qrPng(url, 400);
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(decoded?.data).toBe(url);
  });
});

describe("PNG optimisation", () => {
  it("is lossless and never larger", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><defs><linearGradient id="g"><stop offset="0" stop-color="#f5c"/><stop offset="1" stop-color="#5cf"/></linearGradient><filter id="n"><feTurbulence baseFrequency="0.8"/></filter></defs><rect width="300" height="100" fill="url(#g)"/><rect width="300" height="100" filter="url(#n)" opacity="0.2"/></svg>`;
    const original = await sharp(Buffer.from(svg)).png().toBuffer();
    const optimised = await optimizePng(original);
    expect(optimised.byteLength).toBeLessThanOrEqual(original.byteLength);
    const [a, b] = await Promise.all([original, optimised].map((p) => sharp(p).removeAlpha().raw().toBuffer()));
    expect(a.equals(b)).toBe(true);
  });
});

describe("persistent rate limiting", () => {
  it("allows up to the limit per window, then reports when to retry", async () => {
    const rule = { name: "t", limit: 3, windowSeconds: 60 };
    const t = new Date("2026-11-24T12:00:10Z");
    for (let i = 0; i < 3; i++) expect((await rateLimit(db, rule, "ip1", t)).ok).toBe(true);
    const blocked = await rateLimit(db, rule, "ip1", t);
    expect(blocked).toEqual({ ok: false, retryAfter: 50 });
    expect((await rateLimit(db, rule, "ip2", t)).ok).toBe(true);
    expect((await rateLimit(db, rule, "ip1", new Date("2026-11-24T12:01:00Z"))).ok).toBe(true);
  });

  it("has rules for every write endpoint", () => {
    expect(Object.keys(RULES)).toEqual(expect.arrayContaining(["publish", "update", "refresh", "rotate", "editAuth"]));
  });
});

describe("errors", () => {
  it("CardError carries a code", () => {
    expect(new CardError("conflict", "x").code).toBe("conflict");
  });
});
