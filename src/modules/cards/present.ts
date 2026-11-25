import { bbcode, cardLinks } from "../share/links";
import type { OwnerCardResponse } from "./api-types";
import type { OwnerCard } from "./service";

/** Owner-facing JSON for a card. Never includes the token hash or storage keys. */
export function presentOwnerCard(card: OwnerCard, base: string): OwnerCardResponse {
  const links = cardLinks(base, card.publicId, card.osuUserId);
  return {
    publicId: card.publicId,
    osuUserId: card.osuUserId,
    username: card.username,
    version: card.version,
    imageEtag: card.imageEtag,
    imageBytes: card.imageBytes,
    width: card.width,
    height: card.height,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    statsRefreshedAt: card.statsRefreshedAt,
    refreshError: card.refreshError,
    config: card.config,
    player: card.player,
    links: {
      ...links,
      bbcode: bbcode(links.profile, links.image),
      qr: { card: `/api/qr?kind=card&id=${card.publicId}`, profile: `/api/qr?kind=profile&user=${card.osuUserId}` },
    },
  };
}
