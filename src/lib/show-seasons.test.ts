import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/tmdb", () => ({ getSeasonDetails: vi.fn() }));

import { getSeasonDetails } from "@/lib/tmdb";
import { loadSeasons } from "./show-seasons";

const summary = (n: number) => ({
  season_number: n,
  name: `S${n}`,
  episode_count: 1,
  air_date: null,
  poster_path: null,
});

describe("loadSeasons", () => {
  it("returns empty episodes for a failing season and keeps the others", async () => {
    vi.mocked(getSeasonDetails).mockImplementation(async (_id, season) => {
      if (season === 2) throw new Error("429");
      return { season_number: season, name: "x", episodes: [{ episode_number: 1 } as never] };
    });
    const result = await loadSeasons(1, [summary(1), summary(2)]);
    expect(result.map((s) => s.episodes.length)).toEqual([1, 0]);
    expect(result.map((s) => s.summary.season_number)).toEqual([1, 2]);
  });
});
