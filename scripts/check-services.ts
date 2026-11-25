/**
 * Verifies the configured external services, without printing any secret:
 *   - osu! API credentials (token + one lookup)
 *   - Neon database (connect, migrations applied, round-trip)
 *   - Vercel Blob (upload, read back, delete a small test object)
 *   - EDIT_TOKEN_SECRET / PUBLIC_BASE_URL presence
 *
 * Run: npm run services:check     (reads .env.local)
 */
import { createHash } from "node:crypto";
import { neonDb } from "../src/modules/db/client";
import { MIGRATIONS } from "../src/modules/db/migrations";
import { readOsuCredentials } from "../src/modules/osu/config";
import { OsuClient } from "../src/modules/osu/client";
import { vercelBlobStore } from "../src/modules/storage/images";

let failed = 0;
const pass = (m: string) => console.log(`✓ ${m}`);
const fail = (m: string) => {
  failed++;
  console.log(`✗ ${m}`);
};
const skip = (m: string) => console.log(`– ${m}`);

async function main() {
  // osu!
  const creds = readOsuCredentials();
  if (!creds) fail("OSU_CLIENT_ID / OSU_CLIENT_SECRET missing");
  else {
    try {
      const u = await new OsuClient(creds).getUser({ username: "peppy" }, "osu");
      pass(`osu! API credentials work (looked up ${u.username})`);
    } catch (e) {
      fail(`osu! API: ${(e as Error).message}`);
    }
  }

  // Secrets / URLs
  const secret = process.env.EDIT_TOKEN_SECRET?.trim();
  if (!secret) fail("EDIT_TOKEN_SECRET missing (required in production; generate with: openssl rand -base64 48)");
  else if (secret.length < 32) fail("EDIT_TOKEN_SECRET is shorter than 32 characters");
  else pass("EDIT_TOKEN_SECRET set");
  const base = process.env.PUBLIC_BASE_URL?.trim();
  if (!base) skip("PUBLIC_BASE_URL not set (required in production; locally the request origin is used)");
  else if (!/^https:\/\//.test(base) && !/localhost|127\.0\.0\.1/.test(base)) fail("PUBLIC_BASE_URL should be an https:// URL");
  else pass(`PUBLIC_BASE_URL = ${base}`);

  // Neon
  const url = process.env.DATABASE_URL?.trim();
  if (!url) skip("DATABASE_URL not set: local development uses an in-memory database");
  else {
    try {
      const db = neonDb(url);
      const [{ now }] = await db.query<{ now: string }>("SELECT now()::text AS now");
      pass(`Neon reachable (server time ${now})`);
      const applied = await db.query<{ id: string }>("SELECT id FROM schema_migrations").catch(() => []);
      const missing = MIGRATIONS.filter((m) => !applied.some((a) => a.id === m.id)).map((m) => m.id);
      if (missing.length) fail(`migrations not applied: ${missing.join(", ")} (run npm run db:migrate)`);
      else pass("all migrations applied");
    } catch (e) {
      fail(`Neon: ${(e as Error).message.replace(url, "<DATABASE_URL>")}`);
    }
  }

  // Vercel Blob
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) skip("BLOB_READ_WRITE_TOKEN not set: local development stores images on disk");
  else {
    const access = process.env.BLOB_ACCESS === "public" ? "public" : "private";
    const store = vercelBlobStore(access);
    const body = Buffer.from(`sigcard service check ${Date.now()}`);
    const key = `cards/CHECK00000/${createHash("sha256").update(body).digest("hex").slice(0, 32)}.png`;
    try {
      await store.put(key, body);
      const back = await store.get(key);
      await store.delete(key);
      if (back?.equals(body)) pass(`Vercel Blob upload/read/delete works (access: ${access})`);
      else fail("Vercel Blob: read-back did not match");
    } catch (e) {
      fail(`Vercel Blob (access: ${access}): ${(e as Error).message}`);
    }
  }

  console.log(failed ? `\n${failed} problem(s) found.` : "\nAll configured services look good.");
  process.exit(failed ? 1 : 0);
}

main();
