"use client";

import { useEffect, useState } from "react";
import type { TitleMeta } from "@/lib/backend";
import { loadTitleMeta } from "@/lib/title-meta-client";

export function useTitleMeta(kind: "movie" | "show", tmdbId: number): TitleMeta | null {
  const [loaded, setLoaded] = useState<{ key: string; meta: TitleMeta | null } | null>(null);
  const key = `${kind}:${tmdbId}`;

  useEffect(() => {
    let active = true;
    void loadTitleMeta(kind, tmdbId).then((meta) => {
      if (active) setLoaded({ key, meta });
    });
    return () => {
      active = false;
    };
  }, [kind, tmdbId, key]);

  return loaded?.key === key ? loaded.meta : null;
}
