/**
 * Returns a real HTTP 404 for /card/{id} when the card doesn't exist.
 *
 * With Cache Components the page shell streams with 200 before the card
 * lookup runs, so a status can only be set before rendering starts (see
 * node_modules/next/dist/docs: streaming.md → "The HTTP contract").
 *
 * If the database can't be reached, the request passes through and the page
 * shows its own error state, so an outage never turns into a wall of 404s.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCardService } from "@/modules/server/context";

export async function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/")[2] ?? "";
  try {
    if (await (await getCardService()).exists(id)) return NextResponse.next();
  } catch (e) {
    console.error("[proxy] card lookup failed", (e as Error).message);
    return NextResponse.next();
  }
  // A status set on a rewrite to the (partially prerendered) card page is
  // dropped in production, so route to a path no page matches: Next.js then
  // serves app/not-found.tsx with a genuine 404.
  return NextResponse.rewrite(new URL(MISSING_CARD_PATH, request.url));
}

/** Matches no route on purpose. */
export const MISSING_CARD_PATH = "/_sigcard/missing-card";

export const config = {
  matcher: "/card/:id",
};
