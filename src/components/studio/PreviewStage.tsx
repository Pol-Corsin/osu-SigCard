"use client";
import { useEffect, useState } from "react";
import { CARD_SIZES } from "@/modules/cards/config";
import { renderUrl } from "@/modules/cards/encode";
import { fontLoadDescriptors, fontsFor, type CardFontFamily } from "@/modules/render/fonts";
import { CardRenderer } from "@/modules/templates/CardRenderer";
import { cx, Segmented } from "../ui/controls";
import { useStudioData } from "./useStudioData";

type Source = "live" | "server";
type Zoom = "fit" | "actual";

/** True once the given template families are loaded (avoids a flash of fallback type). */
function useCardFontsReady(families: readonly CardFontFamily[]) {
  const key = families.join(",");
  const [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(fontLoadDescriptors(fontsFor(key.split(",") as CardFontFamily[])).map((d) => document.fonts.load(d)))
      .catch(() => undefined)
      .then(() => alive && setReady(key));
    return () => {
      alive = false;
    };
  }, [key]);
  return ready === key;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PreviewStage() {
  const { config, player, template, assets, failedAssets } = useStudioData();
  const fontsReady = useCardFontsReady(template.fonts);
  const [source, setSource] = useState<Source>("live");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const size = CARD_SIZES[template.sizes.includes(config.size) ? config.size : template.sizes[0]];

  const serverSrc = useDebounced(renderUrl(config, 2), 300);
  const [serverState, setServerState] = useState<{ src: string; status: "loading" | "ok" | "error" }>({ src: "", status: "loading" });
  const status = serverState.src === serverSrc ? serverState.status : "loading";

  const frameStyle = zoom === "actual" ? { width: size.width } : { width: "100%", maxWidth: size.width * 1.25 };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text">{template.name}</h1>
          <p className="truncate text-[12px] text-faint">{template.tagline}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="w-[196px]">
            <Segmented<Source>
              size="sm"
              label="Preview source"
              value={source}
              onChange={setSource}
              options={[
                { value: "live", label: "Live preview", title: "Rendered in your browser as you edit" },
                { value: "server", label: "Server PNG", title: "The actual PNG the server produces" },
              ]}
            />
          </div>
          <div className="w-[128px]">
            <Segmented<Zoom>
              size="sm"
              label="Zoom"
              value={zoom}
              onChange={setZoom}
              options={[
                { value: "fit", label: "Fit" },
                { value: "actual", label: "1:1" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={cx("stage relative flex min-h-[260px] flex-1 overflow-auto p-6 sm:p-10", zoom === "fit" ? "items-center justify-center" : "items-start justify-start")}>
        <div className="m-auto" style={frameStyle}>
          {source === "live" ? (
            fontsReady ? (
              <div key={`${config.template}-${size.id}`} className="card-in card-shadow overflow-hidden rounded-[4px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
                <CardRenderer player={player} config={config} assets={assets} idPrefix="preview" />
              </div>
            ) : (
              <div className="skeleton card-shadow rounded-[4px]" style={{ aspectRatio: `${size.width} / ${size.height}` }} aria-label="Loading card fonts" />
            )
          ) : (
            <div className="relative card-shadow overflow-hidden rounded-[4px]" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={serverSrc}
                alt={`Server-rendered ${template.name} card for ${player.username}`}
                className={cx("block h-auto w-full transition-opacity duration-200", status === "ok" ? "opacity-100" : "opacity-40")}
                onLoad={() => setServerState({ src: serverSrc, status: "ok" })}
                onError={() => setServerState({ src: serverSrc, status: "error" })}
              />
              {status === "loading" && <div className="skeleton absolute inset-0 opacity-50" />}
              {status === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-ink/80 p-4 text-center text-[13px] text-miss">
                  The server couldn&apos;t render this card. Switch back to Live preview and try again.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-5 py-2.5 font-mono text-[11.5px] text-faint">
        <span>
          <span className="text-muted">
            {size.width} × {size.height}
          </span>{" "}
          px
        </span>
        <span>
          exports up to {size.width * 3} × {size.height * 3} (3×)
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cx("size-1.5 rounded-full", source === "live" ? "bg-j100" : status === "ok" ? "bg-j300" : status === "error" ? "bg-miss" : "bg-j50")} />
          {source === "live" ? "Live · updates as you edit" : status === "ok" ? "Server PNG · 2× · same template code" : status === "error" ? "Render failed" : "Rendering on server…"}
        </span>
        {failedAssets.length > 0 && <span className="text-j50">Couldn&apos;t load {failedAssets.join(", ")} · showing fallback</span>}
      </div>
    </div>
  );
}
