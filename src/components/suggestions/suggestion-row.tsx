"use client";

import { useState } from "react";
import type { SuggestionRowView } from "@/lib/backend";
import { SuggestionTile } from "./suggestion-tile";

export function SuggestionRow({ row }: { row: SuggestionRowView }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const items = row.items.filter((i) => !gone.has(`${i.kind}-${i.tmdbId}`));
  if (items.length === 0) return null;

  return (
    <section aria-label={row.title} className="mx-auto w-full max-w-7xl px-4 pt-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">{row.title}</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <li key={`${item.kind}-${item.tmdbId}`} className="shrink-0">
            <SuggestionTile
              item={item}
              onGone={() => setGone((prev) => new Set(prev).add(`${item.kind}-${item.tmdbId}`))}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
