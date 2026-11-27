/**
 * Durable image storage for published card PNGs.
 *
 * Objects are immutable and content-addressed (cards/{publicId}/{etag}.png):
 * an update uploads a new object, repoints the database row, then deletes
 * the old object. The stable public URL is our own /c/{publicId}.png route,
 * which streams whatever object the row points at.
 *
 * - Vercel Blob, enabled by BLOB_STORE_ID (OIDC) or BLOB_READ_WRITE_TOKEN.
 *   The SDK resolves credentials itself, in this order: an OIDC token
 *   (x-vercel-oidc-token header on Vercel, or VERCEL_OIDC_TOKEN / a linked
 *   Vercel CLI locally) together with BLOB_STORE_ID, then BLOB_READ_WRITE_TOKEN.
 *   With OIDC each store only accepts the Vercel environments it allows, so a
 *   Preview or local process can never reach the production store.
 *   Access defaults to "private" (blob URLs are never exposed); set
 *   BLOB_ACCESS=public for a public store.
 * - Local development: files in the local data dir (see server/localData.ts; never on Vercel).
 * - Tests: in-memory.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ConfigError, isHostedDeployment } from "../db/client";
import { localDataDir } from "../server/localData";

export interface ImageStore {
  readonly kind: "vercel-blob" | "local" | "memory";
  put(key: string, png: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<{ key: string; uploadedAt: Date }[]>;
}

const KEY_RE = /^cards\/[0-9A-Za-z]{10}\/[0-9a-f]{16,64}\.png$/;
const assertKey = (key: string) => {
  if (!KEY_RE.test(key)) throw new Error(`Invalid image key: ${key}`);
};

export function vercelBlobStore(access: "public" | "private" = "private"): ImageStore {
  const sdk = () => import("@vercel/blob");
  return {
    kind: "vercel-blob",
    async put(key, png) {
      assertKey(key);
      const { put } = await sdk();
      await put(key, png, {
        access,
        contentType: "image/png",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60 * 60 * 24 * 365, // objects are immutable
      });
    },
    async get(key) {
      assertKey(key);
      const { get } = await sdk();
      const res = await get(key, { access });
      if (!res || res.statusCode !== 200) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    },
    async delete(key) {
      assertKey(key);
      const { del } = await sdk();
      await del(key);
    },
    async list(prefix) {
      const { list } = await sdk();
      const out: { key: string; uploadedAt: Date }[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        for (const b of page.blobs) out.push({ key: b.pathname, uploadedAt: new Date(b.uploadedAt) });
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
  };
}

export function localStore(root = localDataDir("images")): ImageStore {
  const file = (key: string) => path.join(root, ...key.split("/"));
  return {
    kind: "local",
    async put(key, png) {
      assertKey(key);
      await fs.mkdir(path.dirname(file(key)), { recursive: true });
      await fs.writeFile(file(key), png, { flag: "wx" }); // never overwrite
    },
    async get(key) {
      assertKey(key);
      return fs.readFile(file(key)).catch(() => null);
    },
    async delete(key) {
      assertKey(key);
      await fs.rm(file(key), { force: true });
    },
    async list(prefix) {
      const out: { key: string; uploadedAt: Date }[] = [];
      const walk = async (dir: string, rel: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          const r = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) await walk(path.join(dir, e.name), r);
          else if (r.startsWith(prefix)) out.push({ key: r, uploadedAt: (await fs.stat(path.join(dir, e.name))).mtime });
        }
      };
      await walk(root, "");
      return out;
    },
  };
}

export function memoryStore(): ImageStore & { objects: Map<string, Buffer>; failNextPut?: boolean } {
  const objects = new Map<string, Buffer>();
  const store = {
    kind: "memory" as const,
    objects,
    failNextPut: false,
    async put(key: string, png: Buffer) {
      assertKey(key);
      if (store.failNextPut) {
        store.failNextPut = false;
        throw new Error("simulated storage failure");
      }
      if (objects.has(key)) throw new Error("object exists");
      objects.set(key, png);
    },
    async get(key: string) {
      return objects.get(key) ?? null;
    },
    async delete(key: string) {
      objects.delete(key);
    },
    async list(prefix: string) {
      return [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, uploadedAt: new Date(0) }));
    },
  };
  return store;
}

let instance: ImageStore | null = null;

export type BlobCredentials = { storeId: boolean; readWriteToken: boolean };

/** Which Blob credentials are configured (presence only, never values). */
export function blobCredentials(): BlobCredentials {
  return { storeId: !!process.env.BLOB_STORE_ID?.trim(), readWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN?.trim() };
}

export const blobAccess = (): "public" | "private" => (process.env.BLOB_ACCESS === "public" ? "public" : "private");

export function getImageStore(): ImageStore {
  if (instance) return instance;
  const creds = blobCredentials();
  if (creds.storeId || creds.readWriteToken) {
    instance = vercelBlobStore(blobAccess());
  } else if (isHostedDeployment()) {
    throw new ConfigError("Vercel Blob isn't configured (BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN). Publishing needs a Blob store in deployed environments.");
  } else {
    instance = localStore();
  }
  return instance;
}

export function setImageStoreForTests(store: ImageStore | null) {
  instance = store;
}
