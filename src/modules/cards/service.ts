/**
 * Published cards: publish, read, edit, refresh, rotate edit link.
 *
 * Consistency rules (no orphans, no broken URLs):
 *  - Images are immutable objects. A new image is always uploaded BEFORE the
 *    database row points at it; the old image is deleted only AFTER the row
 *    has moved on. A failed database write deletes the image it uploaded.
 *  - Row updates are guarded by an optimistic `version`, so concurrent edits
 *    and refreshes never overwrite each other silently.
 *  - The public ID never changes, so /card/{id} and /c/{id}.png stay stable.
 *  - Leftover objects from crashed requests are swept by scripts/gc-images.ts.
 */
import { createHash } from "node:crypto";
import { CARD_SIZES, cardConfigSchema, type CardConfig } from "./config";
import type { Db } from "../db/client";
import { OsuApiError } from "../osu/errors";
import { SAMPLE_PROFILES } from "../player/fixtures";
import { playerSnapshotSchema } from "../player/schema";
import type { PlayerResult } from "../player/service-types";
import type { GameMode, PlayerSnapshot } from "../player/types";
import { optimizePng } from "../render/optimize";
import { renderCardPng } from "../render/render";
import { cardExists } from "./exists";
import { deriveEditToken, hashEditToken, hashPublishKey, newPublicId, PUBLIC_ID_RE, PUBLISH_KEY_RE, randomEditToken, verifyEditToken } from "../security/tokens";
import type { ImageStore } from "../storage/images";
import { normalizeConfig } from "../templates/normalize";

export type CardErrorCode =
  | "invalid_config"
  | "sample_player"
  | "player_mismatch"
  | "not_found"
  | "unauthorized"
  | "conflict"
  | "token_rotated";

export class CardError extends Error {
  constructor(
    public readonly code: CardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CardError";
  }
}

/** Public view of a card. Contains nothing secret. */
export type PublicCard = {
  publicId: string;
  osuUserId: number;
  username: string;
  mode: GameMode;
  template: string;
  variant: string | null;
  width: number;
  height: number;
  imageEtag: string;
  imageBytes: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  statsRefreshedAt: string;
  player: PlayerSnapshot;
};

/** Owner view: public data plus the editable configuration. */
export type OwnerCard = PublicCard & { config: CardConfig; refreshError: string | null };

type Row = {
  public_id: string;
  osu_user_id: number;
  username: string;
  mode: GameMode;
  template: string;
  variant: string | null;
  width: number;
  height: number;
  config: unknown;
  player: unknown;
  image_key: string;
  image_etag: string;
  image_bytes: number;
  edit_token_hash: string;
  version: number;
  created_at: string | Date;
  updated_at: string | Date;
  stats_refreshed_at: string | Date;
  refresh_error: string | null;
};

export type PlayerSource = { byId(id: number, mode: GameMode, opts?: { fresh?: boolean }): Promise<PlayerResult> };

export type CardServiceDeps = {
  db: Db;
  store: ImageStore;
  players: PlayerSource;
  /** Override for tests; defaults to the real renderer + lossless optimiser. */
  render?: (player: PlayerSnapshot, config: CardConfig) => Promise<Buffer>;
  /** Minimum age before an automatic refresh, ms. Default 12 h. */
  autoRefreshMs?: number;
  now?: () => Date;
};

const iso = (v: string | Date) => (v instanceof Date ? v : new Date(v)).toISOString();
const json = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;
const isSampleId = (id: number) => SAMPLE_PROFILES.some((p) => p.id === id);

function toPublic(r: Row): PublicCard {
  return {
    publicId: r.public_id,
    osuUserId: r.osu_user_id,
    username: r.username,
    mode: r.mode,
    template: r.template,
    variant: r.variant,
    width: r.width,
    height: r.height,
    imageEtag: r.image_etag,
    imageBytes: r.image_bytes,
    version: r.version,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    statsRefreshedAt: iso(r.stats_refreshed_at),
    player: playerSnapshotSchema.parse(json(r.player)),
  };
}

function toOwner(r: Row): OwnerCard {
  return { ...toPublic(r), config: cardConfigSchema.parse(json(r.config)), refreshError: r.refresh_error };
}

const COLUMNS = `public_id, osu_user_id, username, mode, template, variant, width, height, config, player,
  image_key, image_etag, image_bytes, edit_token_hash, version, created_at, updated_at, stats_refreshed_at, refresh_error`;

export class CardService {
  private readonly render: (player: PlayerSnapshot, config: CardConfig) => Promise<Buffer>;
  private readonly now: () => Date;
  private readonly autoRefreshMs: number;

  constructor(private readonly deps: CardServiceDeps) {
    this.render = deps.render ?? (async (p, c) => optimizePng(await renderCardPng(p, c, 1)));
    this.now = deps.now ?? (() => new Date());
    this.autoRefreshMs = deps.autoRefreshMs ?? 12 * 3600_000;
  }

  // ------------------------------------------------------------------ reads

  private async row(publicId: string): Promise<Row | null> {
    if (!PUBLIC_ID_RE.test(publicId)) return null;
    const rows = await this.deps.db.query<Row>(`SELECT ${COLUMNS} FROM cards WHERE public_id = $1`, [publicId]);
    return rows[0] ?? null;
  }

  async getPublic(publicId: string): Promise<PublicCard | null> {
    const r = await this.row(publicId);
    return r ? toPublic(r) : null;
  }

  /** Current image bytes for /c/{id}.png. */
  async getImage(publicId: string): Promise<{ png: Buffer; etag: string; card: PublicCard } | null> {
    const r = await this.row(publicId);
    if (!r) return null;
    const png = await this.deps.store.get(r.image_key);
    if (!png) throw new Error(`Image object missing for card ${publicId}`);
    return { png, etag: r.image_etag, card: toPublic(r) };
  }

  private async authorized(publicId: string, token: string | null): Promise<Row> {
    const r = await this.row(publicId);
    // Same error for "no such card" and "wrong token": don't reveal which IDs exist to token guessers.
    if (!r || !verifyEditToken(token, r.edit_token_hash)) {
      throw new CardError("unauthorized", "This edit link isn't valid. It may have been reset by the card's owner.");
    }
    return r;
  }

  async getForEdit(publicId: string, token: string | null): Promise<OwnerCard> {
    return toOwner(await this.authorized(publicId, token));
  }

  // ---------------------------------------------------------------- helpers

  private validateConfig(input: unknown): CardConfig {
    const parsed = cardConfigSchema.safeParse(input);
    if (!parsed.success) throw new CardError("invalid_config", "The card settings are invalid. Reload the editor and try again.");
    const c = parsed.data;
    if (isSampleId(c.player.id)) {
      throw new CardError("sample_player", "Sample players are fictional and can't be published. Search for a real osu! player first.");
    }
    return normalizeConfig(c);
  }

  private async fetchPlayer(id: number, mode: GameMode): Promise<PlayerSnapshot> {
    const r = await this.deps.players.byId(id, mode);
    if (r.player.isSample) throw new CardError("sample_player", "Sample players can't be published.");
    return r.player;
  }

  private async renderAndUpload(publicId: string, player: PlayerSnapshot, config: CardConfig) {
    const png = await this.render(player, config);
    const etag = createHash("sha256").update(png).digest("hex").slice(0, 32);
    const key = `cards/${publicId}/${etag}.png`;
    try {
      await this.deps.store.put(key, png);
    } catch (e) {
      // Identical bytes already stored under this key (e.g. re-render with no visual change) — reuse it.
      if (!(await this.deps.store.get(key))) throw e;
    }
    return { key, etag, bytes: png.byteLength };
  }

  private async discard(key: string) {
    await this.deps.store.delete(key).catch((e) => console.error("[cards] could not delete image", key, (e as Error).message));
  }

  /**
   * Deletes an image only if no card references it any more. Image keys are
   * content-addressed, so two concurrent writes of the same design produce the
   * same key: the losing request must not delete the object the winner now uses.
   */
  private async discardIfUnreferenced(key: string) {
    const rows = await this.deps.db.query(`SELECT 1 FROM cards WHERE image_key = $1 LIMIT 1`, [key]);
    if (!rows[0]) await this.discard(key);
  }

  /** Cheap existence check (see cards/exists.ts; the proxy calls that directly). */
  async exists(publicId: string): Promise<boolean> {
    return cardExists(this.deps.db, publicId);
  }

  // ---------------------------------------------------------------- publish

  async publish(input: { config: unknown; publishKey: string }): Promise<{ card: OwnerCard; editToken: string; created: boolean }> {
    if (!PUBLISH_KEY_RE.test(input.publishKey)) throw new CardError("invalid_config", "Missing or invalid publish request key.");
    const config = this.validateConfig(input.config);
    const keyHash = hashPublishKey(input.publishKey);

    const existing = await this.byPublishKey(keyHash, input.publishKey);
    if (existing) return existing;

    const player = await this.fetchPlayer(config.player.id, config.player.mode);
    const size = CARD_SIZES[config.size];
    const now = this.now().toISOString();

    for (let attempt = 0; attempt < 3; attempt++) {
      const publicId = newPublicId();
      const editToken = deriveEditToken(publicId, input.publishKey);
      const img = await this.renderAndUpload(publicId, player, config);
      let rows: Row[];
      try {
        rows = await this.deps.db.query<Row>(
          `INSERT INTO cards (public_id, osu_user_id, username, mode, template, template_version, variant, size, width, height,
             config, player, image_key, image_etag, image_bytes, edit_token_hash, publish_key_hash, created_at, updated_at, stats_refreshed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18,$19)
           ON CONFLICT (publish_key_hash) DO NOTHING
           RETURNING ${COLUMNS}`,
          [
            publicId, player.id, player.username, config.player.mode, config.template, config.templateVersion, config.variant,
            config.size, size.width, size.height, JSON.stringify(config), JSON.stringify(player), img.key, img.etag, img.bytes,
            hashEditToken(editToken), keyHash, now, player.fetchedAt,
          ],
        );
      } catch (e) {
        await this.discard(img.key);
        if (/duplicate key|unique/i.test((e as Error).message) && /public_id|cards_pkey/i.test((e as Error).message)) continue; // id collision: retry
        throw e;
      }
      if (rows[0]) return { card: toOwner(rows[0]), editToken, created: true };
      // A concurrent request with the same publish key won the race: drop our image, return theirs.
      await this.discard(img.key);
      const winner = await this.byPublishKey(keyHash, input.publishKey);
      if (winner) return winner;
      throw new CardError("conflict", "Publishing collided with another request. Try again.");
    }
    throw new CardError("conflict", "Couldn't allocate a card ID. Try again.");
  }

  private async byPublishKey(keyHash: string, publishKey: string) {
    const rows = await this.deps.db.query<Row>(`SELECT ${COLUMNS} FROM cards WHERE publish_key_hash = $1`, [keyHash]);
    const r = rows[0];
    if (!r) return null;
    const editToken = deriveEditToken(r.public_id, publishKey);
    if (!verifyEditToken(editToken, r.edit_token_hash)) {
      throw new CardError("token_rotated", "This card was already published and its edit link has since been reset.");
    }
    return { card: toOwner(r), editToken, created: false };
  }

  // ----------------------------------------------------------------- update

  async update(publicId: string, token: string | null, input: { config: unknown; baseVersion?: number }): Promise<OwnerCard> {
    const r = await this.authorized(publicId, token);
    const config = this.validateConfig(input.config);
    if (config.player.id !== r.osu_user_id) {
      throw new CardError("player_mismatch", "A published card stays with its player. Start a new card to publish a different player.");
    }
    if (input.baseVersion !== undefined && input.baseVersion !== r.version) {
      throw new CardError("conflict", "This card changed since you opened it (for example, its stats were refreshed). Reload the edit link and try again.");
    }
    const stored = playerSnapshotSchema.parse(json(r.player));
    // Same mode: keep the stored stats (refresh is a separate action). New mode: fetch that mode.
    const player = config.player.mode === stored.mode ? stored : await this.fetchPlayer(r.osu_user_id, config.player.mode);
    const size = CARD_SIZES[config.size];
    const img = await this.renderAndUpload(publicId, player, config);

    const rows = await this.deps.db.query<Row>(
      `UPDATE cards SET mode = $3, template = $4, template_version = $5, variant = $6, size = $7, width = $8, height = $9,
         config = $10, player = $11, image_key = $12, image_etag = $13, image_bytes = $14, username = $15,
         stats_refreshed_at = $16, version = version + 1, updated_at = $17
       WHERE public_id = $1 AND version = $2
       RETURNING ${COLUMNS}`,
      [
        publicId, r.version, config.player.mode, config.template, config.templateVersion, config.variant, config.size, size.width,
        size.height, JSON.stringify(config), JSON.stringify(player), img.key, img.etag, img.bytes, player.username,
        player === stored ? iso(r.stats_refreshed_at) : player.fetchedAt, this.now().toISOString(),
      ],
    );
    if (!rows[0]) {
      if (img.key !== r.image_key) await this.discardIfUnreferenced(img.key);
      throw new CardError("conflict", "This card changed while saving. Reload the edit link and try again.");
    }
    if (img.key !== r.image_key) await this.discardIfUnreferenced(r.image_key);
    return toOwner(rows[0]);
  }

  // ---------------------------------------------------------------- refresh

  /**
   * Re-fetches osu! stats and regenerates the image. Design config is untouched.
   * Owner refreshes (with token) run now; automatic refreshes only run when the
   * stats are older than autoRefreshMs, and an atomic claim makes sure only one
   * request refreshes a card at a time.
   */
  async refresh(publicId: string, opts: { token?: string | null; automatic?: boolean }): Promise<{ card: OwnerCard | PublicCard; refreshed: boolean; error?: string }> {
    let r: Row | null;
    if (opts.automatic) {
      const now = this.now();
      const rows = await this.deps.db.query<Row>(
        `UPDATE cards SET refresh_attempted_at = $2
         WHERE public_id = $1 AND stats_refreshed_at < $3
           AND (refresh_attempted_at IS NULL OR refresh_attempted_at < $4)
         RETURNING ${COLUMNS}`,
        [publicId, now.toISOString(), new Date(now.getTime() - this.autoRefreshMs).toISOString(), new Date(now.getTime() - 10 * 60_000).toISOString()],
      );
      r = rows[0] ?? null;
      if (!r) return { card: (await this.getPublic(publicId))!, refreshed: false };
    } else {
      r = await this.authorized(publicId, opts.token ?? null);
    }

    const config = cardConfigSchema.parse(json(r.config));
    let player: PlayerSnapshot;
    try {
      const result = await this.deps.players.byId(r.osu_user_id, config.player.mode, { fresh: true });
      if (result.source === "stale") throw new OsuApiError("unavailable", result.warning ?? "osu! is unavailable right now.");
      player = result.player;
    } catch (e) {
      const message = e instanceof OsuApiError ? e.message : "Couldn't reach osu! to refresh stats.";
      await this.deps.db.query(`UPDATE cards SET refresh_error = $2 WHERE public_id = $1`, [publicId, message]);
      if (!opts.automatic) throw e;
      return { card: toPublic(r), refreshed: false, error: message };
    }

    const img = await this.renderAndUpload(publicId, player, config);
    const rows = await this.deps.db.query<Row>(
      `UPDATE cards SET player = $3, username = $4, image_key = $5, image_etag = $6, image_bytes = $7,
         stats_refreshed_at = $8, refresh_error = NULL, version = version + 1, updated_at = $9
       WHERE public_id = $1 AND version = $2
       RETURNING ${COLUMNS}`,
      [publicId, r.version, JSON.stringify(player), player.username, img.key, img.etag, img.bytes, player.fetchedAt, this.now().toISOString()],
    );
    if (!rows[0]) {
      if (img.key !== r.image_key) await this.discardIfUnreferenced(img.key);
      throw new CardError("conflict", "The card changed while refreshing. Try again.");
    }
    if (img.key !== r.image_key) await this.discardIfUnreferenced(r.image_key);
    return { card: opts.automatic ? toPublic(rows[0]) : toOwner(rows[0]), refreshed: true };
  }

  // ------------------------------------------------------------ edit links

  /** Issues a new edit token and revokes the old one. */
  async rotateToken(publicId: string, token: string | null): Promise<string> {
    const r = await this.authorized(publicId, token);
    const next = randomEditToken();
    const rows = await this.deps.db.query(
      `UPDATE cards SET edit_token_hash = $3, updated_at = $4 WHERE public_id = $1 AND edit_token_hash = $2 RETURNING public_id`,
      [publicId, r.edit_token_hash, hashEditToken(next), this.now().toISOString()],
    );
    if (!rows[0]) throw new CardError("conflict", "The edit link changed at the same time. Try again.");
    return next;
  }

  /** Image objects referenced by any card (for garbage collection). */
  async referencedImageKeys(): Promise<Set<string>> {
    const rows = await this.deps.db.query<{ image_key: string }>(`SELECT image_key FROM cards`);
    return new Set(rows.map((r) => r.image_key));
  }
}
