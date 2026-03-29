"use client";

import { useWatchlist } from "@/contexts/watchlist-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MovieCard } from "@/components/movie/movie-card";
import { Heart } from "lucide-react";
import type { Movie } from "@/lib/tmdb";

function WatchlistContent() {
  const { items } = useWatchlist();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Heart className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Deine Watchlist ist leer</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Klicke auf das Herz-Icon bei einem Film, um ihn zu deiner Watchlist
          hinzuzufügen.
        </p>
      </div>
    );
  }

  // Convert WatchlistItems to Movie-like objects for MovieCard
  const movies: Movie[] = items.map((item) => ({
    id: item.movieId,
    title: item.title,
    poster_path: item.posterPath,
    vote_average: item.voteAverage,
    release_date: item.releaseDate,
    overview: "",
    backdrop_path: null,
    original_title: item.title,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    adult: false,
    media_type: "movie",
  }));

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
        Meine Watchlist
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? "Film" : "Filme"}
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}

export default function WatchlistPage() {
  return (
    <ProtectedRoute message="Melde dich an, um deine Watchlist zu sehen.">
      <WatchlistContent />
    </ProtectedRoute>
  );
}
