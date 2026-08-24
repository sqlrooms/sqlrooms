import {describe, expect, test} from '@jest/globals';
import {
  DEFAULT_HEATMAP_COLOR_RANGE,
  DEFAULT_HEATMAP_SCHEME,
  detectHeatmapScheme,
  heatmapSchemeToColorRange,
} from '../src/json/heatmapDefaults';

describe('heatmapDefaults', () => {
  test('missing colorRange uses the renderer default scheme', () => {
    expect(detectHeatmapScheme(undefined)).toBe(DEFAULT_HEATMAP_SCHEME);
    expect(detectHeatmapScheme([])).toBe(DEFAULT_HEATMAP_SCHEME);
    expect(DEFAULT_HEATMAP_SCHEME).toBe('YlOrRd');
  });

  test('detects the default heatmap range as YlOrRd', () => {
    expect(detectHeatmapScheme(DEFAULT_HEATMAP_COLOR_RANGE)).toBe('YlOrRd');
  });

  test('detects a Viridis range chosen in the settings picker', () => {
    expect(detectHeatmapScheme(heatmapSchemeToColorRange('Viridis'))).toBe(
      'Viridis',
    );
  });
});
