import { describe, expect, it } from "vitest";
import { formatTimestamp, shouldAskResume } from "./progress";

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
