import { describe, expect, it } from "vitest";
import { nextEpisode } from "./next-episode";

const seasons = [
  { season_number: 0, episode_count: 3 },
  { season_number: 1, episode_count: 10 },
  { season_number: 2, episode_count: 8 },
];
const last = { season: 2, episode: 3 };
const e = (season: number, episode: number) => ({ season, episode });

describe("nextEpisode", () => {
  it("continues after the last episode had", () => {
    expect(nextEpisode([e(1, 1), e(1, 2), e(1, 3)], seasons, last)).toEqual(e(1, 4));
  });
  it("skips gaps", () => {
    expect(nextEpisode([e(1, 5)], seasons, last)).toEqual(e(1, 6));
  });
  it("starts at S1E1 when nothing was had", () => {
    expect(nextEpisode([], seasons, last)).toEqual(e(1, 1));
  });
  it("rolls over to the next season", () => {
    expect(nextEpisode([e(1, 10)], seasons, last)).toEqual(e(2, 1));
  });
  it("returns null when everything aired is had", () => {
    expect(nextEpisode([e(2, 3)], seasons, last)).toBeNull();
  });
  it("ignores season 0", () => {
    expect(nextEpisode([e(0, 1)], seasons, last)).toEqual(e(1, 1));
  });
  it("returns null without lastAired", () => {
    expect(nextEpisode([e(1, 1)], seasons, null)).toBeNull();
  });
  it("ignores input order", () => {
    expect(nextEpisode([e(1, 3), e(1, 1)], seasons, last)).toEqual(e(1, 4));
  });
});
