// TMDB API client — data foundation for trending, search, genre, and detail views.

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Movie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  genre_ids: number[];
  popularity: number;
  adult: boolean;
  media_type: string;
}

export interface TrendingResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface GenreListResponse {
  genres: Genre[];
}

/** Paginated search / discover response — same shape as TrendingResponse. */
export interface SearchResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Low-level TMDB fetch helper. Reads the API key from env, injects
 * `language=de-DE`, and throws a descriptive error on non-ok responses.
 */
async function tmdbFetch<T>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[tmdb] TMDB_API_KEY is not set — add it to your .env file",
    );
  }

  const url = new URL(`${TMDB_BASE_URL}/${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "de-DE");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(
      `[tmdb] ${endpoint} responded with ${res.status} ${res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch the weekly trending movies list. */
export async function getTrendingMovies(): Promise<Movie[]> {
  const data = await tmdbFetch<TrendingResponse>("trending/movie/week");
  return data.results;
}

/**
 * Search movies by title.
 * Returns an empty results set without hitting the API when `query` is blank.
 */
export async function searchMovies(
  query: string,
  page: number = 1,
): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
  return tmdbFetch<SearchResponse>("search/movie", {
    query: trimmed,
    page: String(page),
  });
}

/** Fetch the full list of movie genres. */
export async function getGenres(): Promise<Genre[]> {
  const data = await tmdbFetch<GenreListResponse>("genre/movie/list");
  return data.genres;
}

/**
 * Discover movies by genre, sorted by popularity (descending).
 */
export async function discoverMoviesByGenre(
  genreId: number,
  page: number = 1,
): Promise<SearchResponse> {
  return tmdbFetch<SearchResponse>("discover/movie", {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    page: String(page),
  });
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/**
 * Build a full poster image URL.
 * Returns `null` when the movie has no poster.
 */
export function getPosterUrl(
  path: string | null,
  size: string = "w342",
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Build a full backdrop image URL.
 * Returns `null` when the movie has no backdrop.
 */
export function getBackdropUrl(
  path: string | null,
  size: string = "w1280",
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
