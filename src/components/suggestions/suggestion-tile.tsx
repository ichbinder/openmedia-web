"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ellipsis, Film } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RatingPanel } from "@/components/rating/rating-panel";
import { PreviewTile } from "@/components/preview/preview-tile";
import { MoviePreviewActions } from "@/components/preview/movie-preview-actions";
import { ShowPreviewActions } from "@/components/preview/show-preview-actions";
import { OriginLabel } from "@/components/meta/origin-label";
import { TileRatings } from "@/components/meta/tile-ratings";
import { usePersons } from "@/hooks/use-persons";
import { useTitleMeta } from "@/hooks/use-title-meta";
import { getToken } from "@/lib/auth";
import { dismissSuggestion, type SuggestionItem } from "@/lib/backend";
import { getPosterUrl, type Movie } from "@/lib/tmdb";

interface SuggestionTileProps {
  item: SuggestionItem;
  onGone: () => void;
}

export function SuggestionTile({ item, onGone }: SuggestionTileProps) {
  const persons = usePersons();
  const meta = useTitleMeta(item.kind, item.tmdbId);
  const [rating, setRating] = useState(false);
  const isShow = item.kind === "show";
  const poster = getPosterUrl(item.posterPath, "w342");
  const year = item.year ? String(item.year) : "";

  async function dismiss() {
    const token = getToken();
    const res = token ? await dismissSuggestion(item.kind, item.tmdbId, token).catch(() => null) : null;
    if (res?.ok) onGone();
    else toast.error("Das hat leider nicht geklappt.");
  }

  return (
    <div className="relative w-40 shrink-0">
      <PreviewTile
        kind={isShow ? "tv" : "movie"}
        id={item.tmdbId}
        title={item.name}
        year={year}
        actions={(data) =>
          isShow ? (
            <ShowPreviewActions showId={item.tmdbId} data={data} />
          ) : (
            <MoviePreviewActions
              movie={{ id: item.tmdbId, title: item.name, poster_path: item.posterPath } as Movie}
            />
          )
        }
      >
        <div className="group relative">
          <Link href={isShow ? `/serie/${item.tmdbId}` : `/movie/${item.tmdbId}`}>
            <Card className="gap-0 overflow-hidden border-0 p-0 ring-0 transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-1 group-hover:ring-cinema-gold/40">
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                {poster ? (
                  <Image src={poster} alt={item.name} fill className="object-cover" sizes="160px" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="size-10 text-muted-foreground" />
                  </div>
                )}
                <OriginLabel meta={meta} className="absolute top-2 left-2" />
              </div>
              <div className="flex flex-col gap-1 p-3">
                <h3 className="truncate text-sm font-medium text-foreground">{item.name}</h3>
                <div className="flex h-4 items-center gap-2 text-xs text-muted-foreground">
                  {year && <span>{year}</span>}
                  <TileRatings meta={meta} />
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </PreviewTile>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.reason}</p>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Mehr Aktionen"
          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
        >
          <Ellipsis className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={dismiss}>Kein Interesse</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRating(true)}>Schon gesehen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rating} onOpenChange={setRating}>
        <DialogContent aria-label="Bewertung" className="bg-transparent p-0 ring-0 sm:max-w-md">
          <RatingPanel
            title={{ kind: item.kind, tmdbId: item.tmdbId, name: item.name }}
            initial={null}
            persons={persons}
            mode="detail"
            onDone={() => {
              setRating(false);
              onGone();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
