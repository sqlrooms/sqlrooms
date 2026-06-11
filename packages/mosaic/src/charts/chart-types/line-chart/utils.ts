export function getChartItemColor(
  colors: readonly string[],
  color: string | undefined,
  index = 0,
): string {
  if (color) {
    return color;
  }

  return colors[index % colors.length]!;
}
