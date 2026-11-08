"use server";

import { getMovieDetails, getShowDetails } from "@/lib/tmdb";
import { pickTrailer } from "@/lib/trailer";

export interface PreviewData {
  trailerKey: string | null;
  backdropPath: string | null;
  overview: string;
  genres: string[];
  numberOfSeasons: number | null;
  seasons: { season_number: number; episode_count: number }[];
  lastAired: { season: number; episode: number } | null;
}

export async function getPreview(
  kind: "movie" | "tv",
  id: number,
): Promise<PreviewData | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  try {
    if (kind === "movie") {
      const movie = await getMovieDetails(id);
      return {
        trailerKey: pickTrailer(movie.videos.results)?.key ?? null,
        backdropPath: movie.backdrop_path,
        overview: movie.overview,
        genres: movie.genres.slice(0, 2).map((g) => g.name),
        numberOfSeasons: null,
        seasons: [],
        lastAired: null,
      };
    }
    const show = await getShowDetails(id);
    const last = show.last_episode_to_air;
    return {
      trailerKey: pickTrailer(show.videos.results)?.key ?? null,
      backdropPath: show.backdrop_path,
      overview: show.overview,
      genres: show.genres.slice(0, 2).map((g) => g.name),
      numberOfSeasons: show.number_of_seasons,
      seasons: show.seasons.map((s) => ({
        season_number: s.season_number,
        episode_count: s.episode_count,
      })),
      lastAired: last
        ? { season: last.season_number, episode: last.episode_number }
        : null,
    };
  } catch (err) {
    console.error("[preview] Action failed:", err);
    return null;
  }
}
