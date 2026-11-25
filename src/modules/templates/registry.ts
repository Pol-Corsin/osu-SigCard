import { TEMPLATE_IDS, type TemplateId } from "../cards/config";
import { template as artistic } from "./artistic/Artistic";
import { template as blackCarbon } from "./black-carbon/BlackCarbon";
import { template as cyberpunk } from "./cyberpunk/Cyberpunk";
import { template as editorial } from "./editorial/Editorial";
import { template as minimal } from "./minimal/Minimal";
import { template as photoAlbum } from "./photo-album/PhotoAlbum";
import { template as playerCard } from "./player-card/PlayerCard";
import { template as raster } from "./raster/Raster";
import type { CardTemplate } from "./types";
import { template as y2k } from "./y2k/Y2K";

/**
 * Template registry. Adding a template = one folder + one line here
 * (plus its id in cards/config TEMPLATE_IDS).
 */
export const TEMPLATES: Record<TemplateId, CardTemplate> = {
  playerCard,
  minimal,
  editorial,
  artistic,
  cyberpunk,
  y2k,
  raster,
  photoAlbum,
  blackCarbon,
};

/**
 * Templates offered in the editor's picker, in picker order. A template
 * left out of this list is retired: saved and published cards that use it
 * still validate and render, but it can't be chosen for new cards.
 */
export const TEMPLATE_ORDER: TemplateId[] = ["minimal", "raster", "editorial", "playerCard", "y2k", "artistic", "photoAlbum", "blackCarbon"];

/** Every renderable template, including retired ones (for tests and render scripts). */
export const ALL_TEMPLATE_IDS: readonly TemplateId[] = TEMPLATE_IDS;

export const isRetired = (id: TemplateId) => !TEMPLATE_ORDER.includes(id);

export const DEFAULT_TEMPLATE: TemplateId = "playerCard";

export function getTemplate(id: TemplateId): CardTemplate {
  return TEMPLATES[id] ?? TEMPLATES[DEFAULT_TEMPLATE];
}

/** The variant a template actually renders for a stored variant id (legacy ids mapped, unknown → default). */
export function resolveVariant(t: CardTemplate, variant: string | null): string | null {
  if (variant && t.variants.some((v) => v.id === variant)) return variant;
  const legacy = variant ? t.legacyVariants?.[variant] : undefined;
  if (legacy && t.variants.some((v) => v.id === legacy)) return legacy;
  return t.defaultVariant;
}
