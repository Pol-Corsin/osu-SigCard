import type { CardConfig } from "../cards/config";
import { getTemplate, resolveVariant } from "./registry";

/**
 * Resolves template-dependent defaults (version, size, variant) the same way
 * on the client and the server, so "unsaved changes" checks and stored
 * configs agree.
 */
export function normalizeConfig(c: CardConfig): CardConfig {
  const t = getTemplate(c.template);
  return {
    ...c,
    templateVersion: t.version,
    size: t.sizes.includes(c.size) ? c.size : t.sizes[0],
    variant: resolveVariant(t, c.variant),
  };
}

/** Stable comparison key for a config (ignores key order). */
export function configKey(c: CardConfig): string {
  const n = normalizeConfig(c);
  return JSON.stringify([n.player, n.template, n.size, n.variant, n.colors, n.stats, n.appearance]);
}
