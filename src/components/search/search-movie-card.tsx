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
 * when the user clicks on it (navigates to detail page).
 */
export function SearchMovieCard({ movie }: SearchMovieCardProps) {
  const handleClick = () => {
    const token = getToken();
    if (!token) return;

    // Fire-and-forget — don't block navigation
    addToSearchHistory(
      {
        movieId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        voteAverage: movie.vote_average,
        releaseDate: movie.release_date,
      },
      token
    ).catch(() => {
      // Silent failure — search history is non-critical
    });
  };

  return (
    <div onClick={handleClick}>
      <MovieCard movie={movie} />
    </div>
  );
}
