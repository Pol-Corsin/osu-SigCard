import { DEFAULT_CONFIG, type CardConfig } from "@/modules/cards/config";
import { STAT_KEYS } from "@/modules/player/format";

export { DEFAULT_CONFIG };
export type { CardConfig };
export const STAT_KEYS_ALL: CardConfig["stats"] = [...STAT_KEYS];
