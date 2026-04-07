import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the underlying TMDB module before importing the action
vi.mock("@/lib/tmdb", () => ({
  searchMovies: vi.fn(),
}));

import { searchMovies } from "@/lib/tmdb";
import { searchTmdbForAssign } from "./tmdb-search";

const mockSearchMovies = vi.mocked(searchMovies);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchTmdbForAssign", () => {
  it("returns an empty array for blank queries without hitting the API", async () => {
    expect(await searchTmdbForAssign("")).toEqual([]);
    expect(await searchTmdbForAssign("  ")).toEqual([]);
    expect(mockSearchMovies).not.toHaveBeenCalled();
  });

  it("returns an empty array for single-character queries", async () => {
    expect(await searchTmdbForAssign("M")).toEqual([]);
    expect(mockSearchMovies).not.toHaveBeenCalled();
  });

  it("maps TMDB results to the slim shape with id/title/year/posterPath", async () => {
    mockSearchMovies.mockResolvedValueOnce({
      page: 1,
      total_pages: 1,
      total_results: 2,
      results: [
        {
          id: 603,
          title: "Matrix",
          original_title: "The Matrix",
          overview: "Ein Hacker entdeckt die Wahrheit.",
          poster_path: "/matrix.jpg",
          backdrop_path: null,
          vote_average: 8.7,
          vote_count: 100,
          release_date: "1999-03-31",
          genre_ids: [28],
          popularity: 99,
          adult: false,
          media_type: "movie",
        },
        {
          id: 604,
          title: "Matrix Reloaded",
          original_title: "The Matrix Reloaded",
          overview: "Fortsetzung",
          poster_path: "/reloaded.jpg",
          backdrop_path: null,
          vote_average: 7.2,
          vote_count: 50,
          release_date: "2003-05-15",
          genre_ids: [28],
          popularity: 80,
          adult: false,
          media_type: "movie",
        },
      ],
    });

    const result = await searchTmdbForAssign("matrix");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 603,
      title: "Matrix",
      originalTitle: "The Matrix",
      year: 1999,
      posterPath: "/matrix.jpg",
    });
    expect(result[1]).toMatchObject({
      id: 604,
      year: 2003,
    });
  });

  it("returns null year when release_date is missing or malformed", async () => {
    mockSearchMovies.mockResolvedValueOnce({
      page: 1,
      total_pages: 1,
      total_results: 2,
      results: [
        {
          id: 1,
          title: "No Date Movie",
          original_title: "No Date Movie",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          release_date: "",
          genre_ids: [],
          popularity: 0,
          adult: false,
          media_type: "movie",
        },
        {
          id: 2,
          title: "Garbage Date",
          original_title: "Garbage Date",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          release_date: "not-a-date",
          genre_ids: [],
          popularity: 0,
          adult: false,
          media_type: "movie",
        },
      ],
    });

    const result = await searchTmdbForAssign("test");
    expect(result).toHaveLength(2);
    expect(result[0].year).toBeNull();
    expect(result[1].year).toBeNull();
  });

  it("filters out entries without an id or title", async () => {
    mockSearchMovies.mockResolvedValueOnce({
      page: 1,
      total_pages: 1,
      total_results: 3,
      results: [
        {
          id: 0, // invalid
          title: "Invalid Id",
          original_title: "",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          release_date: "",
          genre_ids: [],
          popularity: 0,
          adult: false,
          media_type: "movie",
        },
        {
          id: 100,
          title: "", // empty title
          original_title: "",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          release_date: "",
          genre_ids: [],
          popularity: 0,
          adult: false,
          media_type: "movie",
        },
        {
          id: 200,
          title: "Valid Movie",
          original_title: "Valid Movie",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          release_date: "",
          genre_ids: [],
          popularity: 0,
          adult: false,
          media_type: "movie",
        },
      ],
    });

    const result = await searchTmdbForAssign("test");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(200);
  });

  it("limits results to 20 entries", async () => {
    const manyResults = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      title: `Movie ${i + 1}`,
      original_title: `Movie ${i + 1}`,
      overview: "",
      poster_path: null,
      backdrop_path: null,
      vote_average: 0,
      vote_count: 0,
      release_date: "2020-01-01",
      genre_ids: [],
      popularity: 0,
      adult: false,
      media_type: "movie",
    }));
    mockSearchMovies.mockResolvedValueOnce({
      page: 1,
      total_pages: 3,
      total_results: 50,
      results: manyResults,
    });

    const result = await searchTmdbForAssign("test");
    expect(result).toHaveLength(20);
  });

  it("returns an empty array when searchMovies throws", async () => {
    mockSearchMovies.mockRejectedValueOnce(new Error("Network error"));
    const result = await searchTmdbForAssign("matrix");
    expect(result).toEqual([]);
  });
});
