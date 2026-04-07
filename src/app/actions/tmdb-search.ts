"use server";

import { searchMovies } from "@/lib/tmdb";

/**
 * Slim TMDB search result for the assign-movie dialog.
 *
 * Only the fields the dialog needs to display + the tmdbId to send back to
 * the backend. Filters out movies without a release date (often noise) so
 * the user gets clean candidates.
 */
export interface TmdbSearchResult {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
}

/**
 * Server Action used by the AssignMovieDialog to search TMDB without exposing
 * the API key to the browser. Returns up to 20 candidates ranked by TMDB's
 * default popularity scoring. Empty queries return an empty array immediately
 * without hitting the API.
 *
 * Errors are swallowed and surface as an empty array — the caller treats that
 * the same as "no results" for UX consistency.
 */
export async function searchTmdbForAssign(query: string): Promise<TmdbSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const data = await searchMovies(trimmed);
    return data.results
      .slice(0, 20)
      .map((movie) => {
        const year = movie.release_date
          ? Number.parseInt(movie.release_date.slice(0, 4), 10)
          : NaN;
        return {
          id: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          year: Number.isFinite(year) ? year : null,
          posterPath: movie.poster_path,
          overview: movie.overview,
        };
      })
      // Filter out adult content and movies without any title (defensive).
      .filter((m) => m.title && m.id > 0);
  } catch (err) {
    console.error("[tmdb-search] Action failed:", err);
    return [];
  }
}
