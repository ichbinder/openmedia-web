"use client";

import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Show } from "@/lib/tmdb";
import { getPosterUrl } from "@/lib/tmdb";
import { PreviewTile } from "@/components/preview/preview-tile";
import { useTitleMeta } from "@/hooks/use-title-meta";
import { OriginLabel } from "@/components/meta/origin-label";
import { TileRatings } from "@/components/meta/tile-ratings";
import { ShowPreviewActions } from "@/components/preview/show-preview-actions";

export function ShowCard({ show }: { show: Show }) {
  const posterUrl = getPosterUrl(show.poster_path, "w342");
  const year = show.first_air_date?.slice(0, 4) ?? "";
  const meta = useTitleMeta("show", show.id);

  return (
    <PreviewTile
      kind="tv"
      id={show.id}
      title={show.name}
      year={year}
      actions={(data) => <ShowPreviewActions showId={show.id} data={data} />}
    >
      <div className="group relative">
        <Link href={`/serie/${show.id}`}>
          <Card className="gap-0 overflow-hidden border-0 p-0 ring-0 transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-1 group-hover:ring-cinema-gold/40">
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={show.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film className="size-10 text-muted-foreground" />
                </div>
              )}
              <OriginLabel meta={meta} className="absolute top-2 left-2" />
            </div>

            <div className="flex flex-col gap-1 p-3">
              <h3 className="truncate text-sm font-medium text-foreground">
                {show.name}
              </h3>
              <div className="flex h-4 items-center gap-2 text-xs text-muted-foreground">
                {year && <span>{year}</span>}
                <TileRatings meta={meta} />
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </PreviewTile>
  );
}
