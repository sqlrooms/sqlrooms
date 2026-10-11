import {
  continuousSequentialInterpolators,
  continuousSequentialSchemes,
  parseColorString,
  type ContinuousSequentialScheme,
  type ResolvedRGBA,
} from '@sqlrooms/color-scales';

const HEATMAP_COLOR_STEPS = 6;

/**
 * Heatmap GPU weights-texture size.
 */
export const DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE = 512;

/** Default heatmap scheme (YlOrRd, matching deck.gl's built-in default). */
export const DEFAULT_HEATMAP_SCHEME: ContinuousSequentialScheme = 'YlOrRd';

const FALLBACK_YLORRD: ResolvedRGBA[] = [
  [255, 255, 178, 255],
  [254, 178, 76, 255],
  [253, 141, 60, 255],
  [240, 59, 32, 255],
  [189, 0, 38, 255],
  [128, 0, 38, 255],
];

function sampleInterpolator(
  interpolator: (t: number) => string,
): ResolvedRGBA[] {
  return Array.from({length: HEATMAP_COLOR_STEPS}, (_, i) =>
    parseColorString(interpolator(i / (HEATMAP_COLOR_STEPS - 1))),
  );
}

/** Sample a sequential scheme into a heatmap `colorRange`. */
export function heatmapSchemeToColorRange(scheme: string): ResolvedRGBA[] {
  const interpolator =
    continuousSequentialInterpolators[
      scheme as keyof typeof continuousSequentialInterpolators
    ] ?? continuousSequentialInterpolators[DEFAULT_HEATMAP_SCHEME];
  if (!interpolator) {
    return FALLBACK_YLORRD.map((color) => [...color] as ResolvedRGBA);
  }
  return sampleInterpolator(interpolator);
}

/**
 * Named scheme for a heatmap `colorRange`. Missing or unrecognized ranges
 * fall back to {@link DEFAULT_HEATMAP_SCHEME} so the settings picker matches
 * the renderer default.
 */
export function detectHeatmapScheme(colorRange: unknown): string {
  if (!Array.isArray(colorRange) || colorRange.length === 0) {
    return DEFAULT_HEATMAP_SCHEME;
  }
  for (const scheme of continuousSequentialSchemes) {
    const sampled = heatmapSchemeToColorRange(scheme);
    if (sampled.length !== colorRange.length) continue;
    const matches = sampled.every((color, idx) => {
      const actual = colorRange[idx];
      if (!Array.isArray(actual)) return false;
      return (
        Math.abs(color[0] - actual[0]) < 2 &&
        Math.abs(color[1] - actual[1]) < 2 &&
        Math.abs(color[2] - actual[2]) < 2
      );
    });
    if (matches) return scheme;
  }
  return DEFAULT_HEATMAP_SCHEME;
}

/** Default color range for heatmap layers. */
export const DEFAULT_HEATMAP_COLOR_RANGE: ResolvedRGBA[] =
  heatmapSchemeToColorRange(DEFAULT_HEATMAP_SCHEME);
