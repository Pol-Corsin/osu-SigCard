import type { Metadata } from "next";
import { Suspense } from "react";
import { EditLoader } from "./EditLoader";

export const metadata: Metadata = {
  title: "Edit card",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EditPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-[13px] text-muted">Opening your card…</main>}>
      <EditLoader />
    </Suspense>
  );
}
