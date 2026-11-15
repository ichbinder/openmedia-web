import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tmdb", () => ({ tmdbFetch: vi.fn(), TMDB_REVALIDATE: { lists: 1 } }));

import { tmdbFetch } from "@/lib/tmdb";
import { getQuizCandidates } from "./quiz";

const mockFetch = vi.mocked(tmdbFetch);

function page(endpoint: string, page: string) {
  const base = (endpoint === "discover/movie" ? 1000 : 5000) + Number(page) * 100;
  return {
    results: Array.from({ length: 20 }, (_, i) =>
      endpoint === "discover/movie"
        ? { id: base + i, title: `Film ${base + i}`, release_date: "1999-05-01", poster_path: "/p.jpg" }
        : { id: base + i, name: `Serie ${base + i}`, first_air_date: "2015-01-01", poster_path: null },
    ),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (endpoint: string, params) => page(endpoint, params!.page) as never);
});

describe("getQuizCandidates", () => {
  it("returns 20 mixed titles", async () => {
    const result = await getQuizCandidates([]);
    expect(result).toHaveLength(20);
    expect(result.filter((t) => t.kind === "movie")).toHaveLength(10);
    expect(result.filter((t) => t.kind === "show")).toHaveLength(10);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ sort_by: "vote_count.desc" });
    expect(new Set(result.map((t) => `${t.kind}-${t.tmdbId}`)).size).toBe(20);
  });

  it("maps year and poster", async () => {
    const result = await getQuizCandidates([]);
    const movie = result.find((t) => t.kind === "movie")!;
    expect(movie).toMatchObject({ year: 1999, posterPath: "/p.jpg" });
    expect(result.find((t) => t.kind === "show")).toMatchObject({ year: 2015, posterPath: null });
  });

  it("leaves out excluded titles", async () => {
    const first = await getQuizCandidates([]);
    const exclude = first.slice(0, 5).map((t) => `${t.kind}-${t.tmdbId}`);
    mockFetch.mockClear();
    const all = new Set(
      (await Promise.all(Array.from({ length: 5 }, () => getQuizCandidates(exclude)))).flat().map((t) => `${t.kind}-${t.tmdbId}`),
    );
    for (const key of exclude) expect(all.has(key)).toBe(false);
  });

  it("returns an empty array when TMDB fails", async () => {
    mockFetch.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getQuizCandidates([])).toEqual([]);
  });
});
