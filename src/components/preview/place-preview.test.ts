import { describe, it, expect } from "vitest";
import { placePreview } from "./place-preview";

const viewport = { width: 1280, height: 800 };
const size = { width: 360, height: 400 };

describe("placePreview", () => {
  it("centres the preview over a tile in the middle", () => {
    const tile = { left: 600, top: 300, width: 160, height: 280 };
    expect(placePreview(tile, viewport, size)).toEqual({
      left: 600 + 80 - 180,
      top: 300 - 28,
    });
  });

  it("keeps the preview 8 px from the right edge", () => {
    const tile = { left: viewport.width - 100, top: 300, width: 90, height: 140 };
    expect(placePreview(tile, viewport, size).left).toBe(viewport.width - 8 - 360);
  });

  it("keeps the preview 8 px from the left edge", () => {
    const tile = { left: 0, top: 300, width: 90, height: 140 };
    expect(placePreview(tile, viewport, size).left).toBe(8);
  });

  it("keeps the preview inside the viewport at the bottom", () => {
    const tile = { left: 600, top: 700, width: 160, height: 280 };
    const { top } = placePreview(tile, viewport, size);
    expect(top + size.height).toBeLessThanOrEqual(viewport.height - 8);
  });

  it("keeps the preview 8 px from the top edge", () => {
    const tile = { left: 600, top: 0, width: 160, height: 280 };
    expect(placePreview(tile, viewport, size).top).toBe(8);
  });
});
