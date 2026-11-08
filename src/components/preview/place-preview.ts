const MARGIN = 8;

function clamp(value: number, max: number): number {
  return Math.max(MARGIN, Math.min(value, max));
}

export function placePreview(
  tile: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
  size: { width: number; height: number },
): { left: number; top: number } {
  return {
    left: clamp(
      tile.left + tile.width / 2 - size.width / 2,
      viewport.width - MARGIN - size.width,
    ),
    top: clamp(
      tile.top - 0.1 * tile.height,
      viewport.height - MARGIN - size.height,
    ),
  };
}
