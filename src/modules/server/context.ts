/**
 * Server-side wiring shared by route handlers and pages: one CardService
 * built from the configured database, image store and player service.
 */
import { CardService } from "../cards/service";
import { getDb } from "../db/client";
import { getPlayerService } from "../player/service";
import { getImageStore } from "../storage/images";

let override: CardService | null = null;

export async function getCardService(): Promise<CardService> {
  if (override) return override;
  const hours = Number(process.env.STATS_REFRESH_HOURS);
  return new CardService({
    db: await getDb(),
    store: getImageStore(),
    players: getPlayerService(),
    autoRefreshMs: Number.isFinite(hours) && hours > 0 ? hours * 3600_000 : undefined,
  });
}

/** Test hook. */
export function setCardServiceForTests(service: CardService | null) {
  override = service;
}
