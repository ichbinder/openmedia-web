import Image from "next/image";
import Link from "next/link";
import { Film, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Movie } from "@/lib/tmdb";
import { getPosterUrl } from "@/lib/tmdb";
import { WatchlistButton } from "@/components/movie/watchlist-button";

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const posterUrl = getPosterUrl(movie.poster_path, "w342");
  const year = movie.release_date?.split("-")[0] ?? "";

  return (
    <div className="group relative">
      {/* Watchlist overlay */}
      <WatchlistButton movie={movie} variant="card" />

      <Link href={`/movie/${movie.id}`}>
        <Card className="gap-0 overflow-hidden border-0 p-0 ring-0 transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-1 group-hover:ring-cinema-gold/40">
          {/* Poster — 2:3 aspect ratio */}
          <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Film className="size-10 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-1 p-3">
            <h3 className="truncate text-sm font-medium text-foreground">
              {movie.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5 text-cinema-gold">
                <Star className="size-3 fill-cinema-gold" />
                {movie.vote_average.toFixed(1)}
              </span>
              {year && <span>{year}</span>}
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
