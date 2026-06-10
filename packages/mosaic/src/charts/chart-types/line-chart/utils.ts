import {CHART_COLORS} from '../../../constants/chart-colors';

export function getLineColor(color: string | undefined, index: number): string {
  if (color) {
    return color;
  }
  // CHART_COLORS is non-empty, so this is always defined
  return CHART_COLORS[index % CHART_COLORS.length]!;
}
