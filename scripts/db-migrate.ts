/**
 * Applies pending database migrations to DATABASE_URL (Neon).
 * Run: npm run db:migrate          (reads .env.local)
 * Safe to run repeatedly; each migration is applied once.
 */
import { migrate, neonDb } from "../src/modules/db/client";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("✗ DATABASE_URL is not set. Add your Neon connection string to .env.local (see .env.example).");
    process.exit(1);
  }
  const db = neonDb(url);
  const applied = await migrate(db, (m) => console.log(`✓ ${m}`));
  console.log(applied.length ? `Applied ${applied.length} migration(s).` : "Database is up to date.");
}

main().catch((e) => {
  console.error("✗ Migration failed:", (e as Error).message);
  process.exit(1);
});
