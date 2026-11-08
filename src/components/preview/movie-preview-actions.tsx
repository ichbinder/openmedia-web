import Link from "next/link";
import type { Movie } from "@/lib/tmdb";
import { DownloadButton } from "@/components/movie/download-button";
import { WatchlistButton } from "@/components/movie/watchlist-button";

export function MoviePreviewActions({ movie }: { movie: Movie }) {
  return (
    <div className="flex h-9 items-center gap-2">
      <DownloadButton movie={movie} hideWhenUnavailable className="h-9" />
      <WatchlistButton movie={movie} variant="detail" className="h-9" />
      <Link
        href={`/movie/${movie.id}`}
        className="flex h-9 items-center rounded-md bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
      >
        Mehr
      </Link>
    </div>
  );
}
