import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTrendingMovies,
  discoverMoviesByGenre,
  getGenres,
  getMovieDetails,
  searchMovies,
  getTrendingShows,
  searchShows,
  getShowDetails,
  getSeasonDetails,
} from "./tmdb";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ results: [], genres: [] }),
  });
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("TMDB_API_KEY", "k");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const lastCall = () => mockFetch.mock.calls[0];

describe("TMDB movie cache", () => {
  it.each([
    ["getTrendingMovies", () => getTrendingMovies(), "trending/movie/week", 21600],
    ["discoverMoviesByGenre", () => discoverMoviesByGenre(28), "discover/movie", 21600],
    ["getGenres", () => getGenres(), "genre/movie/list", 86400],
    ["getMovieDetails", () => getMovieDetails(1), "movie/1", 86400],
    ["searchMovies", () => searchMovies("dune"), "search/movie", 3600],
  ])("%s revalidates with the right TTL", async (_n, call, endpoint, revalidate) => {
    await call();
    expect(lastCall()).toEqual([
      expect.stringContaining(endpoint),
      { next: { revalidate } },
    ]);
  });
});

describe("TMDB TV client", () => {
  it.each([
    ["getTrendingShows", () => getTrendingShows(), "trending/tv/week", 21600],
    ["searchShows", () => searchShows("dark"), "search/tv", 3600],
    ["getShowDetails", () => getShowDetails(5), "tv/5?", 86400],
    ["getSeasonDetails", () => getSeasonDetails(5, 2), "tv/5/season/2", 86400],
  ])("%s uses the right endpoint and TTL", async (_n, call, endpoint, revalidate) => {
    await call();
    expect(lastCall()).toEqual([
      expect.stringContaining(endpoint),
      { next: { revalidate } },
    ]);
  });

  it("getShowDetails appends credits, videos and similar", async () => {
    await getShowDetails(5);
    expect(decodeURIComponent(lastCall()[0])).toContain(
      "append_to_response=credits,videos,similar",
    );
  });

  it("searchShows skips fetch for a blank query", async () => {
    const res = await searchShows("  ");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(res).toEqual({ page: 1, results: [], total_pages: 0, total_results: 0 });
  });
});
