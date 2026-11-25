import type { ComponentType } from "react";
import type { CardConfig, CardSize, CardSizeId, TemplateId } from "../cards/config";
import type { PlayerSnapshot } from "../player/types";
import type { CardFontFamily } from "../render/fonts";
import type { StatKey } from "../player/format";

/**
 * Image references handed to a template. In the browser these are URLs; on
 * the server they are data URIs (resvg cannot fetch). null = unavailable, and
 * the template must render a designed fallback, never a broken image.
 */
export type TemplateAssets = {
  avatar: string | null;
  cover: string | null;
  flag: string | null;
};

export type TemplateProps = {
  player: PlayerSnapshot;
  config: CardConfig;
  size: CardSize;
  assets: TemplateAssets;
  /** Unique prefix for SVG ids (gradients, clips) so several cards can share a page. */
  idPrefix: string;
};

export type TemplateVariant = { id: string; name: string; description: string };

export type AppearanceSupport = {
  avatarShape: boolean;
  cover: boolean;
  effects: boolean;
  decorations: boolean;
};

/**
 * The contract every card template implements. The editor builds its controls
 * from this metadata, so adding a template needs no UI changes.
 *
 * Templates must be pure: output depends only on props, they only emit SVG
 * elements, they never fetch, and they measure text with modules/render/measure
 * so browser and server agree on layout.
 */
export interface CardTemplate {
  id: TemplateId;
  version: number;
  name: string;
  tagline: string;
  sizes: CardSizeId[];
  variants: TemplateVariant[];
  defaultVariant: string | null;
  /**
   * Variant ids from earlier versions of this template, mapped to their
   * closest current variant, so saved cards keep a sensible look after a
   * redesign instead of silently falling back to the default.
   */
  legacyVariants?: Record<string, string>;
  /** Stats that get a dedicated "hero" treatment instead of a regular slot. */
  heroStats: StatKey[];
  /** How each hero stat is used, shown in the editor (e.g. "Headline"). */
  statRoles: Partial<Record<StatKey, string>>;
  /** Card ground color that primary-colored text sits on, and the contrast the template enforces. */
  ground: (config: CardConfig) => string;
  /** null = primary is only used for shapes/fills on this template, never for text on the ground. */
  contrastTarget: number | null;
  /** Max regular stat slots per size (hero stats excluded). */
  statSlots: Record<CardSizeId, number>;
  supports: AppearanceSupport;
  fonts: CardFontFamily[];
  Component: ComponentType<TemplateProps>;
}
