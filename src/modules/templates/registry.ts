import type { TemplateId } from "../cards/config";
import { template as artistic } from "./artistic/Artistic";
import { template as cyberpunk } from "./cyberpunk/Cyberpunk";
import { template as editorial } from "./editorial/Editorial";
import { template as minimal } from "./minimal/Minimal";
import { template as playerCard } from "./player-card/PlayerCard";
import type { CardTemplate } from "./types";
import { template as y2k } from "./y2k/Y2K";

/**
 * Template registry. Adding a template = one folder + one line here
 * (plus its id in cards/config TEMPLATE_IDS). Order = order in the picker.
 */
export const TEMPLATES: Record<TemplateId, CardTemplate> = {
  playerCard,
  minimal,
  editorial,
  artistic,
  cyberpunk,
  y2k,
};

export const TEMPLATE_ORDER: TemplateId[] = ["playerCard", "minimal", "editorial", "artistic", "cyberpunk", "y2k"];

export const DEFAULT_TEMPLATE: TemplateId = "playerCard";

export function getTemplate(id: TemplateId): CardTemplate {
  return TEMPLATES[id] ?? TEMPLATES[DEFAULT_TEMPLATE];
}
