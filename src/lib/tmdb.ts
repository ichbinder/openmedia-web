// TMDB API client — data foundation for trending, search, genre, and detail views.

// Base URL is overridable via the TMDB_BASE_URL env var so the E2E test
// suite can point this client at the local mock server (see
// e2e/tmdb-mock-server.ts). Falls back to the real TMDB API in dev/prod.
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
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

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface MovieDetail extends Movie {
  runtime: number | null;
  tagline: string | null;
  genres: Genre[];
  production_companies: { id: number; name: string; logo_path: string | null }[];
  status: string;
  budget: number;
  revenue: number;
  credits: { cast: CastMember[] };
  videos: { results: Video[] };
  similar: { results: Movie[] };
}

export interface Show {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string;
  genre_ids: number[];
}

export interface SeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface ShowDetail extends Show {
  number_of_seasons: number;
  seasons: SeasonSummary[];
  genres: Genre[];
  tagline: string | null;
  credits: { cast: CastMember[] };
  videos: { results: Video[] };
  similar: { results: Show[] };
}

export interface EpisodeSummary {
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface SeasonDetail {
  season_number: number;
  name: string;
  episodes: EpisodeSummary[];
}

export interface ShowSearchResponse {
  page: number;
  results: Show[];
  total_pages: number;
  total_results: number;
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

export const TMDB_REVALIDATE = {
  lists: 21600,
  details: 86400,
  search: 3600,
} as const;

/**
 * Low-level TMDB fetch helper. Reads the API key from env, injects
 * `language=de-DE`, and throws a descriptive error on non-ok responses.
 */
async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string> | undefined,
  revalidate: number,
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

  const res = await fetch(url.toString(), { next: { revalidate } });

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
  const data = await tmdbFetch<TrendingResponse>(
    "trending/movie/week",
    undefined,
    TMDB_REVALIDATE.lists,
  );
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
  }, TMDB_REVALIDATE.search);
}

/** Fetch the full list of movie genres. */
export async function getGenres(): Promise<Genre[]> {
  const data = await tmdbFetch<GenreListResponse>(
    "genre/movie/list",
    undefined,
    TMDB_REVALIDATE.details,
  );
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
  }, TMDB_REVALIDATE.lists);
}

/**
 * Fetch full movie details including credits, videos, and similar movies.
 * Uses `append_to_response` to combine four requests into a single API call.
 */
export async function getMovieDetails(id: number): Promise<MovieDetail> {
  return tmdbFetch<MovieDetail>(`movie/${id}`, {
    append_to_response: "credits,videos,similar",
  }, TMDB_REVALIDATE.details);
}

/** Fetch the weekly trending TV shows list. */
export async function getTrendingShows(): Promise<Show[]> {
  const data = await tmdbFetch<{ results: Show[] }>(
    "trending/tv/week",
    undefined,
    TMDB_REVALIDATE.lists,
  );
  return data.results;
}

/** Search TV shows by title; blank queries return empty results without a request. */
export async function searchShows(
  query: string,
  page: number = 1,
): Promise<ShowSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
  return tmdbFetch<ShowSearchResponse>(
    "search/tv",
    { query: trimmed, page: String(page) },
    TMDB_REVALIDATE.search,
  );
}

/** Fetch full show details including credits, videos, and similar shows. */
export async function getShowDetails(id: number): Promise<ShowDetail> {
  return tmdbFetch<ShowDetail>(
    `tv/${id}`,
    { append_to_response: "credits,videos,similar" },
    TMDB_REVALIDATE.details,
  );
}

/** Fetch one season with its episodes. */
export async function getSeasonDetails(
  id: number,
  season: number,
): Promise<SeasonDetail> {
  return tmdbFetch<SeasonDetail>(
    `tv/${id}/season/${season}`,
    undefined,
    TMDB_REVALIDATE.details,
  );
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

/**
 * Build a full profile image URL (cast/crew photos).
 * Returns `null` when the person has no profile image.
 */
export function getProfileUrl(
  path: string | null,
  size: string = "w185",
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
