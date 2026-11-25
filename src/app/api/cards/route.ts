/**
 * POST /api/cards — publish a card.
 * Body: { config: CardConfig, publishKey: string }  (publishKey: client-generated
 * random idempotency key; retries with the same key return the same card).
 * Player stats are always fetched server-side; nothing the client says about
 * the player is trusted.
 */
import { presentOwnerCard } from "@/modules/cards/present";
import { baseUrl } from "@/modules/server/baseUrl";
import { getCardService } from "@/modules/server/context";
import { errorResponse, HttpError, limit, NO_STORE, readJson } from "@/modules/server/http";
import { RULES } from "@/modules/security/rateLimit";
import { editLink } from "@/modules/share/links";
import type { PublishResponse } from "@/modules/cards/api-types";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request, 8_192)) as { config?: unknown; publishKey?: unknown } | null;
    if (!body || typeof body !== "object" || typeof body.publishKey !== "string") {
      throw new HttpError(400, "bad_request", "Missing card settings.");
    }
    await limit(request, RULES.publish);
    const service = await getCardService();
    const { card, editToken, created } = await service.publish({ config: body.config, publishKey: body.publishKey });
    const base = baseUrl(request);
    const res: PublishResponse = { card: presentOwnerCard(card, base), editToken, editUrl: editLink(base, card.publicId, editToken), created };
    return Response.json(res, { status: created ? 201 : 200, headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
