/**
 * POST /api/cards/{id}/token — reset the private edit link (Bearer current token).
 * The old link stops working immediately; the response contains the new one.
 */
import { baseUrl } from "@/modules/server/baseUrl";
import { getCardService } from "@/modules/server/context";
import { errorResponse, limit, NO_STORE } from "@/modules/server/http";
import { RULES } from "@/modules/security/rateLimit";
import { bearerToken } from "@/modules/security/tokens";
import { editLink } from "@/modules/share/links";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await limit(request, RULES.editAuth);
    await limit(request, RULES.rotate, id);
    const editToken = await (await getCardService()).rotateToken(id, bearerToken(request));
    return Response.json({ editToken, editUrl: editLink(baseUrl(request), id, editToken) }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
