"use client";
import { useEffect, useState } from "react";
import { configKey } from "@/modules/templates/normalize";
import { Button, cx } from "../ui/controls";
import { Lock, Reset } from "../ui/icons";
import { CardApiError, newPublishKey, publishCard, refreshCard, updateCard } from "./cardsApi";
import { ShareDialog } from "./ShareDialog";
import { useStudio } from "./store";
import { isSampleId, useStudioData } from "./useStudioData";

type Busy = null | "publish" | "update" | "refresh";

function ago(iso: string, now: number) {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function PublishPanel() {
  const { config, playerStatus } = useStudioData();
  const published = useStudio((s) => s.published);
  const publishKey = useStudio((s) => s.publishKey);
  const setPublishKey = useStudio((s) => s.setPublishKey);
  const setPublished = useStudio((s) => s.setPublished);
  const updatePublishedCard = useStudio((s) => s.updatePublishedCard);
  const now = useNow();

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; fresh: boolean }>({ open: false, fresh: false });
  const [confirmNew, setConfirmNew] = useState(false);

  const sample = isSampleId(config.player.id);
  const loadingPlayer = playerStatus.kind === "loading";
  const otherPlayer = !!published && published.card.osuUserId !== config.player.id;
  const dirty = !!published && !otherPlayer && configKey(config) !== configKey(published.card.config);

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof CardApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const publish = () =>
    run("publish", async () => {
      // Reuse the pending key if a previous attempt may have reached the server.
      const key = publishKey ?? newPublishKey();
      if (!publishKey) setPublishKey(key);
      const r = await publishCard(config, key);
      setPublished({ card: r.card, editToken: r.editToken, editUrl: r.editUrl });
      setDialog({ open: true, fresh: true });
    });

  const update = () =>
    run("update", async () => {
      const r = await updateCard(published!.card.publicId, published!.editToken, config, published!.card.version);
      updatePublishedCard(r.card);
    });

  const refresh = () =>
    run("refresh", async () => {
      const r = await refreshCard(published!.card.publicId, published!.editToken);
      updatePublishedCard(r.card);
    });

  // ------------------------------------------------------------ unpublished
  if (!published || otherPlayer) {
    return (
      <div className="rounded-[12px] border border-line bg-ink/40 p-4">
        {otherPlayer && (
          <p className="mb-3 text-[11.5px] leading-4 text-muted">
            Your published card belongs to <strong className="text-soft">{published!.card.username}</strong>. Publishing this player creates a separate card with
            its own links.{" "}
            <button type="button" className="text-approach hover:underline" onClick={() => setDialog({ open: true, fresh: false })}>
              Show existing card
            </button>
          </p>
        )}
        <Button variant="primary" className="w-full" disabled={sample || loadingPlayer || !!busy} onClick={publish}>
          {busy === "publish" ? "Publishing…" : sample ? (
            <>
              <Lock /> Publish card
            </>
          ) : otherPlayer ? (
            "Publish as new card"
          ) : (
            "Publish card"
          )}
        </Button>
        <p className={cx("mt-2.5 text-[11.5px] leading-4", error ? "text-miss" : "text-faint")} aria-live="polite">
          {error ??
            (busy === "publish"
              ? "Fetching current stats, rendering and uploading your card…"
              : sample
                ? "Sample players are fictional. Search for a real osu! player to publish."
                : "Creates a permanent image link, osu! BBCode, QR codes and a private edit link. No account needed.")}
        </p>
        {published && <ShareDialog open={dialog.open} justPublished={false} onClose={() => setDialog({ open: false, fresh: false })} />}
      </div>
    );
  }

  // -------------------------------------------------------------- published
  const card = published.card;
  return (
    <div className="rounded-[12px] border border-line bg-ink/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2 rounded-full bg-j100" />
        <span className="text-[12.5px] font-semibold text-text">Published</span>
        <a href={card.links.page} target="_blank" rel="noreferrer" className="ml-auto truncate font-mono text-[11px] text-approach hover:underline">
          /card/{card.publicId}
        </a>
      </div>

      <div className="grid gap-2">
        <Button variant={dirty ? "primary" : "ghost"} className="w-full" disabled={!dirty || !!busy || loadingPlayer} onClick={update}>
          {busy === "update" ? "Saving…" : dirty ? "Update published card" : "Published card is up to date"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" className="px-2 text-[12.5px]" onClick={() => setDialog({ open: true, fresh: false })}>
            Share
          </Button>
          <Button variant="ghost" className="px-2 text-[12.5px]" disabled={!!busy} onClick={refresh}>
            <Reset /> {busy === "refresh" ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <p className={cx("mt-2.5 text-[11.5px] leading-4", error ? "text-miss" : "text-faint")} aria-live="polite">
        {error ??
          (dirty
            ? "You have changes that aren't on the published card yet. Updating keeps the same links."
            : `Stats from ${ago(card.statsRefreshedAt, now)}. The image also refreshes itself about twice a day.`)}
      </p>
      {card.refreshError && !error && <p className="mt-1 text-[11.5px] leading-4 text-j50">Last refresh failed: {card.refreshError}</p>}

      <div className="mt-3 border-t border-line pt-3">
        {!confirmNew ? (
          <button type="button" className="text-[11.5px] text-muted hover:text-text" onClick={() => setConfirmNew(true)}>
            Start a new card instead…
          </button>
        ) : (
          <div className="text-[11.5px] leading-4 text-muted">
            The published card stays online. Save its edit link first if you want to change it later.
            <div className="mt-2 flex gap-2">
              <Button variant="ghost" className="px-3 py-1.5 text-[12px]" onClick={() => setDialog({ open: true, fresh: false })}>
                Show edit link
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setPublished(null);
                  setConfirmNew(false);
                }}
              >
                Start new card
              </Button>
            </div>
          </div>
        )}
      </div>

      <ShareDialog open={dialog.open} justPublished={dialog.fresh} onClose={() => setDialog({ open: false, fresh: false })} />
    </div>
  );
}
