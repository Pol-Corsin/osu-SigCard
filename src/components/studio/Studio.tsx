"use client";
import { useEffect, useState } from "react";
import { BrandMark } from "../ui/icons";
import { ConfigPanel } from "./ConfigPanel";
import { ExportPanel } from "./ExportPanel";
import { PlayerPanel } from "./PlayerPanel";
import { PreviewStage } from "./PreviewStage";
import { useStudio } from "./store";
import { useLivePlayerSync } from "./useStudioData";

function LiveSync() {
  useLivePlayerSync();
  return null;
}

function CardTitle() {
  const published = useStudio((s) => s.published);
  if (!published) return <span className="hidden text-[13px] text-muted sm:inline">Untitled card</span>;
  return (
    <span className="hidden text-[13px] text-muted sm:inline">
      Editing <span className="text-soft">{published.card.username}</span>{" "}
      <span className="font-mono text-[11.5px] text-faint">/card/{published.card.publicId}</span>
    </span>
  );
}

export function Studio() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    Promise.resolve(useStudio.persist.rehydrate()).finally(() => setHydrated(true));
  }, []);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-5">
        <BrandMark />
        <span className="font-display text-[15px] font-extrabold tracking-[-0.01em]">Signature Card Studio</span>
        <span className="hidden text-faint sm:inline">/</span>
        <CardTitle />
        <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-faint">
          <span className="size-1.5 rounded-full bg-j100" />
          <span className="hidden sm:inline">Draft saved in this browser</span>
          <span className="sm:hidden">Draft saved</span>
        </span>
      </header>

      {hydrated ? (
        <>
        <LiveSync />
        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[312px_minmax(0,1fr)_296px]">
          <aside aria-label="Card settings" className="studio-scroll order-2 min-w-0 overflow-x-hidden border-line bg-panel lg:order-1 lg:overflow-y-auto lg:border-r">
            <ConfigPanel />
          </aside>
          <div className="order-1 min-h-0 border-b border-line lg:order-2 lg:border-b-0">
            <PreviewStage />
          </div>
          <aside aria-label="Player and export" className="studio-scroll order-3 border-t border-line bg-panel lg:overflow-y-auto lg:border-l lg:border-t-0">
            <PlayerPanel />
            <ExportPanel />
          </aside>
        </main>
        </>
      ) : (
        <main className="grid flex-1 place-items-center">
          <div className="skeleton h-40 w-[min(640px,80vw)] rounded-[6px]" aria-label="Loading studio" />
        </main>
      )}
    </div>
  );
}
