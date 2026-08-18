import {CELL_COUNT, RASTER_HEIGHT, RASTER_WIDTH} from './types';

/** Pure CPU-side data and mask-coordinate mapping for one raster tile. */
export type EcmwfTileSlice = {
  data: Float32Array;
  relRow: number;
  relCol: number;
  width: number;
  height: number;
  maskUvOffset: [number, number];
  maskUvScale: [number, number];
};

/**
 * Slices a [lead][cell] cube into a [lead][row][column] tile buffer.
 * Pixels beyond the cropped cube remain NaN so the raster shader discards them.
 */
export function sliceCubeToTile(
  cube: Float32Array,
  leadCount: number,
  relRow: number,
  relCol: number,
  width: number,
  height: number,
): Float32Array {
  const layerSize = width * height;
  const data = new Float32Array(layerSize * leadCount).fill(Number.NaN);
  const copyHeight = Math.max(0, Math.min(height, RASTER_HEIGHT - relRow));
  const copyWidth = Math.max(0, Math.min(width, RASTER_WIDTH - relCol));
  for (let lead = 0; lead < leadCount; lead += 1) {
    for (let row = 0; row < copyHeight; row += 1) {
      const src = lead * CELL_COUNT + (relRow + row) * RASTER_WIDTH + relCol;
      data.set(
        cube.subarray(src, src + copyWidth),
        lead * layerSize + row * width,
      );
    }
  }
  return data;
}

/** Builds the data buffer and mask UV transform for a Zarr tile request. */
export function createEcmwfTileSlice(
  cube: Float32Array,
  leadCount: number,
  options: {
    tileRow: number;
    tileCol: number;
    tileWidth: number;
    tileHeight: number;
    width: number;
    height: number;
  },
): EcmwfTileSlice {
  const relRow = options.tileRow * options.tileHeight;
  const relCol = options.tileCol * options.tileWidth;
  return {
    data: sliceCubeToTile(
      cube,
      leadCount,
      relRow,
      relCol,
      options.width,
      options.height,
    ),
    relRow,
    relCol,
    width: options.width,
    height: options.height,
    maskUvOffset: [relCol / RASTER_WIDTH, relRow / RASTER_HEIGHT],
    maskUvScale: [options.width / RASTER_WIDTH, options.height / RASTER_HEIGHT],
  };
}
