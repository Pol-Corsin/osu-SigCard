/** Response shapes shared by the cards API and the studio client. */
import type { CardConfig } from "./config";
import type { PlayerSnapshot } from "../player/types";

export type CardLinksResponse = {
  page: string;
  image: string;
  profile: string;
  bbcode: string;
  qr: { card: string; profile: string };
};

export type OwnerCardResponse = {
  publicId: string;
  osuUserId: number;
  username: string;
  version: number;
  imageEtag: string;
  imageBytes: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  statsRefreshedAt: string;
  refreshError: string | null;
  config: CardConfig;
  player: PlayerSnapshot;
  links: CardLinksResponse;
};

/** Publish and rotate responses also carry the private edit token (shown once to the owner). */
export type PublishResponse = { card: OwnerCardResponse; editToken: string; editUrl: string; created: boolean };
