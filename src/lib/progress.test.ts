import { describe, expect, it } from "vitest";
import type { NextEpisode } from "./backend";
import { formatTimestamp, nextEpisodePhase, shouldAskResume } from "./progress";

describe("shouldAskResume", () => {
  it("fragt nicht ohne Stand", () => {
    expect(shouldAskResume(null)).toBe(false);
  });
  it("fragt bei angefangenem Titel", () => {
    expect(shouldAskResume({ positionSec: 2832, durationSec: 6000, finished: false })).toBe(true);
  });
  it("fragt nicht bei fertigem Titel", () => {
    expect(shouldAskResume({ positionSec: 2832, durationSec: 6000, finished: true })).toBe(false);
  });
});

describe("formatTimestamp", () => {
  it("formatiert Minuten, Stunden und Sekunden", () => {
    expect(formatTimestamp(2832)).toBe("47:12");
    expect(formatTimestamp(3723)).toBe("1:02:03");
    expect(formatTimestamp(59)).toBe("0:59");
  });
});

describe("nextEpisodePhase", () => {
  const playable: NextEpisode = {
    showTmdbId: 1, season: 1, episode: 2, titleDe: null, nzbFileId: "f", request: null,
  };
  const notDownloaded = { ...playable, nzbFileId: null };

  it("zeigt den Knopf erst in den letzten 60 s", () => {
    expect(nextEpisodePhase(120, false, playable)).toBe("hidden");
    expect(nextEpisodePhase(60, false, playable)).toBe("button");
  });
  it("zählt am Ende herunter", () => {
    expect(nextEpisodePhase(0, true, playable)).toBe("countdown");
  });
  it("bietet den Download an, wenn die Folge fehlt", () => {
    expect(nextEpisodePhase(30, false, notDownloaded)).toBe("download");
    expect(nextEpisodePhase(120, false, notDownloaded)).toBe("hidden");
  });
  it("bleibt ohne Folge versteckt", () => {
    expect(nextEpisodePhase(0, true, null)).toBe("hidden");
  });
});
