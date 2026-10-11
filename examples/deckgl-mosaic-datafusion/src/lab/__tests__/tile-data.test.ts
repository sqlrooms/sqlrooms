import {describe, expect, test} from '@jest/globals';
import {CELL_COUNT, RASTER_HEIGHT, RASTER_WIDTH} from '../types';
import {createEcmwfTileSlice, sliceCubeToTile} from '../tile-data';

function cubeWithCoordinates(leadCount: number) {
  return Float32Array.from(
    {length: leadCount * CELL_COUNT},
    (_, index) => index,
  );
}

describe('ECMWF tile mapping', () => {
  test('copies every lead into a full in-bounds tile', () => {
    const cube = cubeWithCoordinates(2);

    expect(Array.from(sliceCubeToTile(cube, 2, 0, 0, 2, 2))).toEqual([
      0,
      1,
      RASTER_WIDTH,
      RASTER_WIDTH + 1,
      CELL_COUNT,
      CELL_COUNT + 1,
      CELL_COUNT + RASTER_WIDTH,
      CELL_COUNT + RASTER_WIDTH + 1,
    ]);
  });

  test('keeps right and bottom edge padding as NaN', () => {
    const cube = cubeWithCoordinates(2);
    const data = sliceCubeToTile(
      cube,
      2,
      RASTER_HEIGHT - 1,
      RASTER_WIDTH - 1,
      2,
      2,
    );

    expect(data[0]).toBe(CELL_COUNT - 1);
    expect(data[4]).toBe(2 * CELL_COUNT - 1);
    expect([data[1], data[2], data[3], data[5], data[6], data[7]]).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
      Number.NaN,
      Number.NaN,
      Number.NaN,
    ]);
  });

  test('maps tile pixels onto the shared selection-mask UVs', () => {
    const slice = createEcmwfTileSlice(cubeWithCoordinates(1), 1, {
      tileRow: 1,
      tileCol: 1,
      tileWidth: 32,
      tileHeight: 32,
      width: 32,
      height: 16,
    });

    expect(slice.maskUvOffset).toEqual([0.5, 2 / 3]);
    expect(slice.maskUvScale).toEqual([0.5, 1 / 3]);
    expect(slice.data[0]).toBe(32 * RASTER_WIDTH + 32);
    expect(slice.data[slice.data.length - 1]).toBe(CELL_COUNT - 1);
  });
});
