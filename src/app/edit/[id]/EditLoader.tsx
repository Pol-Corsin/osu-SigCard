"use client";
/**
 * Private edit link: /edit/{publicId}#{token}
 *
 * The token lives in the URL fragment, which browsers never send to servers
 * (so it can't leak into access logs or Referer headers). It is read here,
 * checked against the API with an Authorization header, and on success the
 * published configuration is loaded into the studio.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CardApiError, loadCard } from "@/components/studio/cardsApi";
import { useStudio } from "@/components/studio/store";
import { BrandMark } from "@/components/ui/icons";

type State = { kind: "loading" } | { kind: "error"; title: string; message: string };

export function EditLoader() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  // Captured once: effects may run twice (Strict Mode), and the fragment is cleared after the first read.
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current ??= decodeURIComponent(window.location.hash.slice(1));
    const token = tokenRef.current;
    // Remove the token from the address bar right away (it's kept in memory, then in this browser's storage).
    window.history.replaceState(null, "", `/edit/${id}`);
    let alive = true;
    (async () => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        setState({ kind: "error", title: "This edit link is incomplete", message: "The private part of the link is missing. Copy the whole edit link, including everything after the #." });
        return;
      }
      try {
        await useStudio.persist.rehydrate();
        const { card } = await loadCard(id, token);
        if (!alive) return;
        useStudio.getState().loadForEdit(card, token, `${window.location.origin}/edit/${id}#${token}`);
        router.replace("/studio");
      } catch (e) {
        if (!alive) return;
        const err = e instanceof CardApiError ? e : new CardApiError("unknown", "Couldn't open this card. Try again.");
        setState({
          kind: "error",
          title: err.code === "unauthorized" ? "This edit link doesn't work" : "Couldn't open this card",
          message: err.message,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, router]);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[440px] rounded-[18px] border border-line bg-panel p-7 text-center">
        <div className="mx-auto mb-4 w-fit">
          <BrandMark size={36} />
        </div>
        {state.kind === "loading" ? (
          <>
            <h1 className="font-display text-[20px] font-semibold">Opening your card…</h1>
            <p className="mt-1.5 text-[13px] text-muted">Checking the edit link and loading the published design.</p>
            <div className="skeleton mx-auto mt-5 h-2 w-40 rounded-full" />
          </>
        ) : (
          <>
            <h1 className="font-display text-[20px] font-semibold">{state.title}</h1>
            <p className="mt-1.5 text-[13px] leading-5 text-muted">{state.message}</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href={`/card/${id}`} className="rounded-ctl border border-line px-4 py-2 text-[13px] font-semibold hover:bg-raised">
                View public card
              </Link>
              <Link href="/studio" className="rounded-ctl bg-hit px-4 py-2 text-[13px] font-semibold text-hit-ink">
                Open the studio
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
