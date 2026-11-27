/**
 * Cheap "does this card exist?" check, kept free of the renderer, image
 * storage and osu! client so src/proxy.ts stays a small function bundle
 * (it runs before every /card/{id} request).
 */
import type { Db } from "../db/client";
import { PUBLIC_ID_RE } from "../security/tokens";

export async function cardExists(db: Db, publicId: string): Promise<boolean> {
  if (!PUBLIC_ID_RE.test(publicId)) return false;
  return (await db.query(`SELECT 1 FROM cards WHERE public_id = $1`, [publicId])).length > 0;
}
