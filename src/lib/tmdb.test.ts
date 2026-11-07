import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTrendingMovies,
  discoverMoviesByGenre,
  getGenres,
  getMovieDetails,
  searchMovies,
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
