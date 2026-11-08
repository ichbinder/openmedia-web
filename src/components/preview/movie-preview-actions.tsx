import Link from "next/link";
import type { Movie } from "@/lib/tmdb";
import { DownloadButton } from "@/components/movie/download-button";
import { WatchlistButton } from "@/components/movie/watchlist-button";

export function MoviePreviewActions({ movie }: { movie: Movie }) {
  return (
    <div className="flex h-9 items-center gap-2">
      <DownloadButton
        movie={movie}
        hideWhenUnavailable
        className="h-9 gap-1.5 px-3 text-xs whitespace-nowrap"
      />
      <WatchlistButton
        movie={movie}
        className="static size-9 shrink-0 rounded-md bg-muted backdrop-blur-none hover:bg-muted/80"
      />
      <Link
        href={`/movie/${movie.id}`}
        className="flex h-9 shrink-0 items-center rounded-md bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
      >
        Mehr
      </Link>
    </div>
  );
}
