import {
  continuousSequentialInterpolators,
  parseColorString,
} from '@sqlrooms/color-scales';

const HEATMAP_COLOR_STEPS = 6;

/**
 * Size of the GPU weights texture used for heatmap aggregation.
 * Matches deck.gl's HeatmapLayer default (2048).
 */
export const DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE = 2048;

/** Default color range for heatmap layers (YlOrRd, matching deck.gl's built-in default). */
export const DEFAULT_HEATMAP_COLOR_RANGE: Array<
  [number, number, number, number]
> = continuousSequentialInterpolators.YlOrRd
  ? Array.from({length: HEATMAP_COLOR_STEPS}, (_, i) =>
      parseColorString(
        continuousSequentialInterpolators.YlOrRd(i / (HEATMAP_COLOR_STEPS - 1)),
      ),
    )
  : [
      [255, 255, 178, 255],
      [254, 178, 76, 255],
      [253, 141, 60, 255],
      [240, 59, 32, 255],
      [189, 0, 38, 255],
      [128, 0, 38, 255],
    ];
