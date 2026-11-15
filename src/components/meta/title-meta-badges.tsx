"use client";

import { useTitleMeta } from "@/hooks/use-title-meta";
import { OriginLabel } from "./origin-label";
import { AllRatings } from "./all-ratings";

export function TitleMetaBadges({ kind, tmdbId }: { kind: "movie" | "show"; tmdbId: number }) {
  const meta = useTitleMeta(kind, tmdbId);
  return (
    <div className="flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1">
      <OriginLabel meta={meta} />
      <AllRatings meta={meta} />
    </div>
  );
}
