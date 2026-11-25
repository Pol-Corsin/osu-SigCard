/**
 * Owner endpoints for a published card. All require
 * `Authorization: Bearer <edit token>`; the token is checked on every request.
 *
 * GET   /api/cards/{id}  → full configuration for the editor
 * PATCH /api/cards/{id}  → { config, baseVersion } update design; same public ID and URLs
 */
import { presentOwnerCard } from "@/modules/cards/present";
import { baseUrl } from "@/modules/server/baseUrl";
import { getCardService } from "@/modules/server/context";
import { errorResponse, HttpError, limit, NO_STORE, readJson } from "@/modules/server/http";
import { RULES } from "@/modules/security/rateLimit";
import { bearerToken } from "@/modules/security/tokens";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await limit(request, RULES.editAuth);
    const card = await (await getCardService()).getForEdit(id, bearerToken(request));
    return Response.json({ card: presentOwnerCard(card, baseUrl(request)) }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await limit(request, RULES.editAuth);
    const body = (await readJson(request, 8_192)) as { config?: unknown; baseVersion?: unknown } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "bad_request", "Missing card settings.");
    const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : undefined;
    await limit(request, RULES.update, id);
    const card = await (await getCardService()).update(id, bearerToken(request), { config: body.config, baseVersion });
    return Response.json({ card: presentOwnerCard(card, baseUrl(request)) }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
