"use client";

import type { Movie } from "@/lib/tmdb";
import { MovieCard } from "@/components/movie/movie-card";
import { getToken } from "@/lib/auth";
import { addToSearchHistory } from "@/lib/backend";

interface SearchMovieCardProps {
  movie: Movie;
}

/**
 * MovieCard wrapper for search results — saves the movie to search history
 * when the user clicks the card link (navigates to detail page).
 * Uses onClickCapture to catch the event before it reaches child elements,
 * and only fires for the Link click (not WatchlistButton).
 */
export function SearchMovieCard({ movie }: SearchMovieCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Don't save to history when clicking the WatchlistButton overlay
    const target = e.target as HTMLElement;
    if (target.closest("[data-watchlist-button]")) return;

    const token = getToken();
    if (!token) return;

    // Fire-and-forget — don't block navigation
    addToSearchHistory(token, {
      movieId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      voteAverage: movie.vote_average,
      releaseDate: movie.release_date,
    }).catch(() => {
      // Silent failure — search history is non-critical
    });
  };

  return (
    <div onClickCapture={handleClick}>
      <MovieCard movie={movie} />
    </div>
  );
}
