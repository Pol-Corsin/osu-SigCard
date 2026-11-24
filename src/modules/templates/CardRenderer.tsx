import { CARD_SIZES, type CardConfig } from "../cards/config";
import type { PlayerSnapshot } from "../player/types";
import { getTemplate } from "./registry";
import type { TemplateAssets } from "./types";

type Props = {
  player: PlayerSnapshot;
  config: CardConfig;
  assets: TemplateAssets;
  idPrefix: string;
};

/**
 * Renders a card to an <svg> element. Used directly by the browser preview
 * and through renderToStaticMarkup by the server renderer — one code path.
 */
export function CardRenderer({ player, config, assets, idPrefix }: Props) {
  const template = getTemplate(config.template);
  const sizeId = template.sizes.includes(config.size) ? config.size : template.sizes[0];
  const Component = template.Component;
  return (
    <Component
      player={player}
      config={{ ...config, variant: config.variant ?? template.defaultVariant }}
      size={CARD_SIZES[sizeId]}
      assets={assets}
      idPrefix={idPrefix}
    />
  );
}
