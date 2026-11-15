import { describe, expect, it } from "vitest";
import type { RatingView } from "./backend";
import { shouldAskRating } from "./rating";

const movie = { kind: "movie" as const, tmdbId: 1, name: "Film" };
const show = { kind: "show" as const, tmdbId: 2, name: "Serie" };
const base = { title: movie, seasonFinale: false, rating: null, positionSec: 0, durationSec: 100, ended: true };
const rated = (verdict: RatingView["verdict"]): RatingView => ({
  kind: "movie", tmdbId: 1, verdict, tags: [], forWhom: null, source: "app", ratedAt: "2026-01-01",
});

describe("shouldAskRating", () => {
  it("asks for an unrated movie that ended", () => {
    expect(shouldAskRating(base)).toBe(true);
  });
  it("asks when closed at 92 percent", () => {
    expect(shouldAskRating({ ...base, ended: false, positionSec: 92 })).toBe(true);
  });
  it("does not ask at 80 percent", () => {
    expect(shouldAskRating({ ...base, ended: false, positionSec: 80 })).toBe(false);
  });
  it("does not ask when already rated", () => {
    expect(shouldAskRating({ ...base, rating: rated("up") })).toBe(false);
  });
  it("asks when only seen", () => {
    expect(shouldAskRating({ ...base, rating: rated(null) })).toBe(true);
  });
  it("asks for a season finale even with a rating", () => {
    expect(shouldAskRating({ ...base, title: show, seasonFinale: true, rating: { ...rated("up"), kind: "show" } })).toBe(true);
  });
  it("does not ask for a normal episode", () => {
    expect(shouldAskRating({ ...base, title: show })).toBe(false);
  });
  it("does not ask without title or duration", () => {
    expect(shouldAskRating({ ...base, title: null })).toBe(false);
    expect(shouldAskRating({ ...base, durationSec: 0 })).toBe(false);
  });
});
