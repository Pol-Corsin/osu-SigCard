"use client";
import { useEffect, useRef, useState } from "react";
import { QrTile } from "../share/QrTile";
import { Button, cx } from "../ui/controls";
import { CopyField } from "../ui/CopyField";
import { Check, Download, Lock } from "../ui/icons";
import { CardApiError, rotateEditLink } from "./cardsApi";
import { useStudio } from "./store";

/**
 * Publishing results: the card, its permanent URLs, osu! BBCode, both QR
 * codes and the private edit link. Uses a native <dialog> for focus
 * trapping and Escape-to-close.
 */
export function ShareDialog({ open, onClose, justPublished }: { open: boolean; onClose: () => void; justPublished: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const published = useStudio((s) => s.published);
  const updatePublishedCard = useStudio((s) => s.updatePublishedCard);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetState, setResetState] = useState<{ busy: boolean; error?: string; done?: boolean }>({ busy: false });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!published) return null;
  const { card, editUrl, editToken } = published;
  const l = card.links;
  const imgSrc = `${l.image}?v=${card.imageEtag}`;

  const reset = async () => {
    setResetState({ busy: true });
    try {
      const r = await rotateEditLink(card.publicId, editToken);
      updatePublishedCard(card, r);
      setResetState({ busy: false, done: true });
      setConfirmReset(false);
    } catch (e) {
      setResetState({ busy: false, error: e instanceof CardApiError ? e.message : "Couldn't reset the link. Try again." });
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="share-title"
      className="m-auto max-h-[92dvh] w-[min(980px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-line bg-panel p-0 text-text shadow-[0_40px_120px_-30px_rgb(0_0_0/.9)] backdrop:bg-ink/75 backdrop:backdrop-blur-sm"
    >
      <div className="studio-scroll max-h-[92dvh] overflow-y-auto">
        <header className="flex items-start gap-3 border-b border-line px-6 py-5">
          <span className={cx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", justPublished ? "bg-j100/15 text-j100" : "bg-raised text-muted")}>
            <Check />
          </span>
          <div className="min-w-0">
            <h2 id="share-title" className="font-display text-[20px] font-semibold tracking-[-0.01em]">
              {justPublished ? "Your card is live" : "Share & links"}
            </h2>
            <p className="text-[13px] text-muted">
              {card.username} · permanent link{" "}
              <a href={l.page} target="_blank" rel="noreferrer" className="font-mono text-approach hover:underline">
                /card/{card.publicId}
              </a>
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto rounded-ctl px-2.5 py-1.5 text-[13px] text-muted hover:bg-raised hover:text-text">
            Close
          </button>
        </header>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 content-start gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc} alt={`${card.username}'s signature card`} width={card.width} height={card.height} className="card-shadow h-auto w-full rounded-[4px]" />

            <section className="rounded-[14px] border border-hit/30 bg-hit/[0.04] p-4">
              <CopyField
                label="osu! BBCode"
                value={l.bbcode}
                emphasis
                hint={
                  <>
                    On osu!, open your profile, click the edit button on the <strong className="text-soft">me!</strong> section, paste this, then save. The image links to your profile.
                  </>
                }
              />
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="Direct image URL (PNG)" value={l.image} />
              <CopyField label="Public card page" value={l.page} />
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={`${l.image}?download=1`} download className="inline-flex items-center gap-2 rounded-ctl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-text hover:border-line-strong hover:bg-raised">
                <Download /> Download PNG
              </a>
              <a href={l.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-ctl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-text hover:border-line-strong hover:bg-raised">
                Open public page
              </a>
              <a href={l.profile} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-ctl px-3 py-2.5 text-[13.5px] text-muted hover:text-text">
                osu! profile ↗
              </a>
            </div>
          </div>

          <aside className="grid content-start gap-5">
            <div>
              <h3 className="mb-2 text-[12px] font-medium text-muted">QR codes</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <QrTile title="Card page" caption={l.page} src={l.qr.card} />
                <QrTile title="osu! profile" caption={l.profile} src={l.qr.profile} />
              </div>
            </div>

            <section className="rounded-[14px] border border-j50/30 bg-j50/[0.04] p-4">
          <div className="mb-3 flex items-start gap-2 text-[12px] leading-[18px] text-j50">
            <Lock className="mt-0.5 shrink-0" />
            <p>
              <strong>Private edit link.</strong> Anyone with it can change this card, so don&apos;t post it publicly. It&apos;s also saved in this browser.
            </p>
          </div>
          <CopyField label="Edit link" value={editUrl} tone="warning" />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
            {!confirmReset ? (
              <Button variant="quiet" onClick={() => setConfirmReset(true)} className="-ml-2">
                Reset edit link…
              </Button>
            ) : (
              <>
                <span className="text-muted">The current link will stop working immediately.</span>
                <Button variant="ghost" onClick={reset} disabled={resetState.busy} className="px-3 py-1.5 text-[12.5px]">
                  {resetState.busy ? "Resetting…" : "Reset link"}
                </Button>
                <Button variant="quiet" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </>
            )}
            {resetState.done && <span className="text-j100">New link created. The old one no longer works.</span>}
            {resetState.error && <span className="text-miss">{resetState.error}</span>}
          </div>
            </section>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
