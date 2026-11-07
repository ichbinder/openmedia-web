import { describe, it, expect } from "vitest";
import { isEpisodeFilename } from "./episode-filename";

describe("isEpisodeFilename", () => {
  it("erkennt SxxEyy-Muster", () => {
    expect(isEpisodeFilename("Some.Show.S02E05.1080p.WEB.nzb")).toBe(true);
    expect(isEpisodeFilename("some show s1e10 720p.nzb")).toBe(true);
    expect(isEpisodeFilename("Show.S02.E05.nzb")).toBe(true);
    expect(isEpisodeFilename("Show S02 E05")).toBe(true);
  });

  it("erkennt Filme nicht als Folgen", () => {
    expect(isEpisodeFilename("The.Matrix.1999.1080p.BluRay.nzb")).toBe(false);
    expect(isEpisodeFilename("Mission.S1E.Impossible.nzb")).toBe(false);
  });

  it("behandelt fehlende Dateinamen", () => {
    expect(isEpisodeFilename(undefined)).toBe(false);
    expect(isEpisodeFilename(null)).toBe(false);
    expect(isEpisodeFilename("")).toBe(false);
  });
});
