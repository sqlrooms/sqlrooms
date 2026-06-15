/**
 * Find the first unused color from the palette.
 * Scans the used colors and returns the first palette color not in the set.
 * If all colors are used, returns the first color.
 */
export function getUnusedColor(
  colors: readonly string[],
  usedColors: string[],
): string {
  const usedSet = new Set(usedColors);

  // Find first unused color
  for (const color of colors) {
    if (!usedSet.has(color)) {
      return color;
    }
  }

  // All colors used, fallback to first color
  return colors[0]!;
}
