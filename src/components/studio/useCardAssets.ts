"use client";
/**
 * Browser-side asset references for the live preview. Each image is probed
 * once; if it fails to load (deleted avatar, network error) the template gets
 * null and draws its designed fallback, exactly like the server renderer does.
 */
import { useEffect, useState } from "react";
import type { PlayerSnapshot } from "@/modules/player/types";
import type { TemplateAssets } from "@/modules/templates/types";

const status = new Map<string, "ok" | "failed">();

function probe(url: string): Promise<"ok" | "failed"> {
  const known = status.get(url);
  if (known) return Promise.resolve(known);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      status.set(url, "ok");
      resolve("ok");
    };
    img.onerror = () => {
      status.set(url, "failed");
      resolve("failed");
    };
    img.src = url;
  });
}

export function useCardAssets(player: PlayerSnapshot): { assets: TemplateAssets; failed: string[] } {
  const refs = {
    avatar: player.avatarUrl,
    cover: player.coverUrl,
    flag: `/flags/${player.countryCode.toUpperCase()}.svg`,
  };
  const key = `${refs.avatar}|${refs.cover}|${refs.flag}`;
  const [failed, setFailed] = useState<{ key: string; list: string[] }>({ key, list: [] });

  useEffect(() => {
    let alive = true;
    const entries = Object.entries(refs).filter((e): e is [string, string] => !!e[1]);
    Promise.all(entries.map(async ([name, url]) => ((await probe(url)) === "failed" ? name : null))).then((r) => {
      if (alive) setFailed({ key, list: r.filter((x): x is string => !!x) });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const list = failed.key === key ? failed.list : [];
  const pick = (name: keyof TemplateAssets) => (list.includes(name) ? null : refs[name]);
  return { assets: { avatar: pick("avatar"), cover: pick("cover"), flag: pick("flag") }, failed: list };
}
