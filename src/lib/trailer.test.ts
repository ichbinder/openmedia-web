import { describe, it, expect } from "vitest";
import { pickTrailer } from "./trailer";
import type { Video } from "./tmdb";

const video = (id: string, over: Partial<Video> = {}): Video => ({
  id,
  key: id,
  name: id,
  site: "YouTube",
  type: "Trailer",
  official: false,
  iso_639_1: "de",
  ...over,
});

describe("pickTrailer", () => {
  it("returns null for an empty list", () => {
    expect(pickTrailer([])).toBeNull();
  });

  it("ignores non-YouTube and non-Trailer videos", () => {
    expect(
      pickTrailer([
        video("a", { type: "Teaser" }),
        video("b", { site: "Vimeo" }),
      ]),
    ).toBeNull();
  });

  it("prefers de official > de > en official > en > rest", () => {
    const rest = video("rest", { iso_639_1: null });
    const en = video("en", { iso_639_1: "en" });
    const enOfficial = video("enOfficial", { iso_639_1: "en", official: true });
    const de = video("de");
    const deOfficial = video("deOfficial", { official: true });

    expect(pickTrailer([rest, en, enOfficial, de, deOfficial])?.id).toBe("deOfficial");
    expect(pickTrailer([rest, en, enOfficial, de])?.id).toBe("de");
    expect(pickTrailer([rest, en, enOfficial])?.id).toBe("enOfficial");
    expect(pickTrailer([rest, en])?.id).toBe("en");
    expect(pickTrailer([rest])?.id).toBe("rest");
  });
});
