/** Breakpoints and layout constants for responsive parishioner UI */

export const COMPACT_MAX = 380;
export const TABLET_MIN = 768;
export const CONTENT_MAX_WIDTH = 720;
export const GRID_GAP = 12;

export function getGridColumns(width: number): number {
  if (width < COMPACT_MAX) return 1;
  if (width >= TABLET_MIN) return 3;
  return 2;
}

export function getContentPadding(width: number): number {
  if (width < COMPACT_MAX) return 16;
  if (width >= TABLET_MIN) return 24;
  return 20;
}

export function getGridItemWidth(
  screenWidth: number,
  columns: number,
  gap: number = GRID_GAP,
  horizontalPadding: number = 40,
  maxWidth: number = CONTENT_MAX_WIDTH
): number {
  const containerWidth = Math.min(screenWidth, maxWidth) - horizontalPadding;
  return (containerWidth - gap * (columns - 1)) / columns;
}
