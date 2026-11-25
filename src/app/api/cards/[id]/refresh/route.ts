/** POST /api/cards/{id}/refresh — owner-triggered stats refresh (Bearer edit token). */
import type { OwnerCard } from "@/modules/cards/service";
import { presentOwnerCard } from "@/modules/cards/present";
import { baseUrl } from "@/modules/server/baseUrl";
import { getCardService } from "@/modules/server/context";
import { errorResponse, limit, NO_STORE } from "@/modules/server/http";
import { RULES } from "@/modules/security/rateLimit";
import { bearerToken } from "@/modules/security/tokens";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await limit(request, RULES.editAuth);
    await limit(request, RULES.refresh, id);
    const { card } = await (await getCardService()).refresh(id, { token: bearerToken(request) });
    return Response.json({ card: presentOwnerCard(card as OwnerCard, baseUrl(request)) }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
