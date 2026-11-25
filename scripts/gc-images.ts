/**
 * Deletes stored card images that no card points at any more (left behind
 * if a request crashed between uploading a new image and deleting the old
 * one). Only objects older than one hour are touched, so in-flight publishes
 * are never affected.
 *
 * Run: npm run images:gc            (dry run: lists what would be deleted)
 *      npm run images:gc -- --delete
 */
import { CardService } from "../src/modules/cards/service";
import { getDb } from "../src/modules/db/client";
import { getPlayerService } from "../src/modules/player/service";
import { getImageStore } from "../src/modules/storage/images";

async function main() {
  const really = process.argv.includes("--delete");
  const db = await getDb();
  const store = getImageStore();
  const service = new CardService({ db, store, players: getPlayerService() });
  const referenced = await service.referencedImageKeys();
  const cutoff = Date.now() - 3600_000;
  const objects = await store.list("cards/");
  const orphans = objects.filter((o) => !referenced.has(o.key) && o.uploadedAt.getTime() < cutoff);
  console.log(`${objects.length} stored images, ${referenced.size} referenced, ${orphans.length} orphaned (older than 1 h).`);
  for (const o of orphans) {
    if (really) await store.delete(o.key);
    console.log(`${really ? "deleted" : "would delete"} ${o.key}`);
  }
  if (!really && orphans.length) console.log("Dry run. Re-run with --delete to remove them.");
}

main().catch((e) => {
  console.error("✗", (e as Error).message);
  process.exit(1);
});
