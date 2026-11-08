import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tmdb", () => ({
  getMovieDetails: vi.fn(),
  getShowDetails: vi.fn(),
}));

import { getMovieDetails, getShowDetails } from "@/lib/tmdb";
import { getPreview } from "./preview";

const mockMovie = vi.mocked(getMovieDetails);
const mockShow = vi.mocked(getShowDetails);

const trailer = (key: string, iso: string) => ({
  id: key,
  key,
  name: "t",
  site: "YouTube",
  type: "Trailer",
  official: true,
  iso_639_1: iso,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPreview", () => {
  it("maps movie details", async () => {
    mockMovie.mockResolvedValue({
      backdrop_path: "/b.jpg",
      overview: "Plot",
      genres: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
        { id: 3, name: "C" },
      ],
      videos: { results: [trailer("en1", "en"), trailer("de1", "de")] },
    } as never);

    expect(await getPreview("movie", 5)).toEqual({
      trailerKey: "de1",
      backdropPath: "/b.jpg",
      overview: "Plot",
      genres: ["A", "B"],
      numberOfSeasons: null,
      seasons: [],
      lastAired: null,
    });
    expect(mockMovie).toHaveBeenCalledWith(5);
  });

  it("maps show details", async () => {
    mockShow.mockResolvedValue({
      backdrop_path: null,
      overview: "Show",
      genres: [{ id: 1, name: "Drama" }],
      number_of_seasons: 2,
      seasons: [
        { season_number: 1, name: "S1", episode_count: 8, air_date: null, poster_path: null },
        { season_number: 2, name: "S2", episode_count: 10, air_date: null, poster_path: null },
      ],
      last_episode_to_air: { season_number: 2, episode_number: 4 },
      videos: { results: [] },
    } as never);

    expect(await getPreview("tv", 7)).toEqual({
      trailerKey: null,
      backdropPath: null,
      overview: "Show",
      genres: ["Drama"],
      numberOfSeasons: 2,
      seasons: [
        { season_number: 1, episode_count: 8 },
        { season_number: 2, episode_count: 10 },
      ],
      lastAired: { season: 2, episode: 4 },
    });
  });

  it("returns null lastAired when TMDB has none", async () => {
    mockShow.mockResolvedValue({
      overview: "",
      genres: [],
      number_of_seasons: 1,
      seasons: [],
      last_episode_to_air: null,
      videos: { results: [] },
    } as never);
    expect((await getPreview("tv", 7))?.lastAired).toBeNull();
  });

  it("returns null when TMDB throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockMovie.mockRejectedValue(new Error("boom"));
    expect(await getPreview("movie", 5)).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns null for invalid ids without calling TMDB", async () => {
    expect(await getPreview("movie", 0)).toBeNull();
    expect(await getPreview("tv", 1.5)).toBeNull();
    expect(mockMovie).not.toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
  });
});
