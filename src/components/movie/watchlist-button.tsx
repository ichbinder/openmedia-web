"use client";

import { Heart } from "lucide-react";
import { useWatchlist } from "@/contexts/watchlist-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
  };
  /** "card" = small overlay icon, "detail" = larger button with text */
  variant?: "card" | "detail";
  className?: string;
}

export function WatchlistButton({
  movie,
  variant = "card",
  className,
}: WatchlistButtonProps) {
  const { user } = useAuth();
  const { add, remove, isInWatchlist } = useWatchlist();
  const router = useRouter();

  const inWatchlist = isInWatchlist(movie.id);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (inWatchlist) {
      remove(movie.id);
    } else {
      add({
        movieId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        voteAverage: movie.vote_average,
        releaseDate: movie.release_date,
      });
    }
  }

  if (variant === "detail") {
    return (
      <button
        onClick={handleClick}
        data-watchlist-button
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          inWatchlist
            ? "bg-cinema-gold/20 text-cinema-gold hover:bg-cinema-gold/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          className
        )}
      >
        <Heart
          className={cn("size-4", inWatchlist && "fill-cinema-gold text-cinema-gold")}
        />
        {inWatchlist ? "Auf der Watchlist" : "Zur Watchlist"}
      </button>
    );
  }

  // card variant — small overlay icon
  return (
    <button
      onClick={handleClick}
      data-watchlist-button
      className={cn(
        "absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-colors hover:bg-black/80",
        className
      )}
      aria-label={inWatchlist ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}
    >
      <Heart
        className={cn(
          "size-4",
          inWatchlist
            ? "fill-cinema-gold text-cinema-gold"
            : "text-white"
        )}
      />
    </button>
  );
}
