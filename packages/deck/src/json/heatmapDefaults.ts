import {
  continuousSequentialInterpolators,
  parseColorString,
} from '@sqlrooms/color-scales';

const HEATMAP_COLOR_STEPS = 6;

/**
 * Size of the GPU weights texture used for heatmap aggregation.
 *
 * deck.gl defaults to 2048, which makes the max-weight pass take ~50–100ms.
 * Kepler.gl uses 512 (~5–7ms) so radius/intensity sliders stay interactive.
 * Smaller values are faster but more pixelated.
 */
export const DEFAULT_HEATMAP_WEIGHTS_TEXTURE_SIZE = 512;

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
