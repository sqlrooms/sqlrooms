import * as zarr from 'zarrita';
import {openEcmwfArray, openEcmwfGroup} from './ecmwf-store';
import {
  CELL_COUNT,
  ECMWF_ENSEMBLE_MEMBER,
  ECMWF_TEMPERATURE_VARIABLE,
  ECMWF_X_START,
  ECMWF_Y_START,
  RASTER_HEIGHT,
  RASTER_WIDTH,
} from './types';

/**
 * Full forecast cube for the cropped region, streamed chunk by chunk from
 * the public Zarr store. temperature is laid out [lead][cell]; NaN marks
 * samples that are missing or not yet fetched. The whole cube is handed to
 * DataFusion to build the cells_all_leads table and to the map for per-cell
 * coloring.
 */
export type TimeCube = {
  temperature: Float32Array;
  leadCount: number;
  cellCount: number;
  leadHours: number[];
  validTimeMs: number[];
};

export type CubeStream = {
  cube: TimeCube;
  /**
   * Per-cell 0/1 flag flipped as the cell's store chunk lands. Mutated in
   * place, so consumers always see the latest coverage.
   */
  loaded: Uint8Array;
  totalChunks: number;
  done: Promise<void>;
};

type ChunkRect = {x0: number; x1: number; y0: number; y1: number};

/**
 * Splits the crop into store-chunk-aligned rectangles. In the current store,
 * each rectangle spans one 32x32 inner shard chunk; the lead and ensemble
 * dimensions are each stored in a single chunk and are requested together.
 */
function chunkRects(chunkWidth: number, chunkHeight: number): ChunkRect[] {
  const rects: ChunkRect[] = [];
  const xEnd = ECMWF_X_START + RASTER_WIDTH;
  const yEnd = ECMWF_Y_START + RASTER_HEIGHT;
  for (let y0 = ECMWF_Y_START; y0 < yEnd; ) {
    const y1 = Math.min(yEnd, (Math.floor(y0 / chunkHeight) + 1) * chunkHeight);
    for (let x0 = ECMWF_X_START; x0 < xEnd; ) {
      const x1 = Math.min(xEnd, (Math.floor(x0 / chunkWidth) + 1) * chunkWidth);
      rects.push({x0, x1, y0, y1});
      x0 = x1;
    }
    y0 = y1;
  }
  return rects;
}

/**
 * Resolves once the coordinate metadata is loaded and the NaN-filled cube
 * is allocated. The chunk fetches keep streaming in the background, marking
 * loaded and invoking onChunk as each one is copied into the cube.
 */
export async function streamTimeCube(
  onChunk: (loadedChunks: number, totalChunks: number) => void,
): Promise<CubeStream> {
  const arr = await openEcmwfArray(ECMWF_TEMPERATURE_VARIABLE);
  if (!arr.is('float32')) {
    throw new Error(
      `Expected ${ECMWF_TEMPERATURE_VARIABLE} to be float32, got ${arr.dtype}`,
    );
  }
  const initTimeIndex = (arr.shape[0] ?? 1) - 1;
  const shapedLeadCount = arr.shape[1] ?? 1;

  const group = await openEcmwfGroup();
  const [leadArr, initArr, ingestedLengthArr] = await Promise.all([
    zarr.open.v3(group.resolve('lead_time'), {kind: 'array'}),
    zarr.open.v3(group.resolve('init_time'), {kind: 'array'}),
    zarr.open.v3(group.resolve('ingested_forecast_length'), {kind: 'array'}),
  ]);
  const [leadData, initData, ingestedLengthData] = await Promise.all([
    zarr.get(leadArr, null),
    zarr.get(initArr, null),
    zarr.get(ingestedLengthArr, null),
  ]);
  const allLeadHours = Array.from(
    leadData.data as Float64Array,
    (seconds) => seconds / 3600,
  );
  const ingestedSeconds = Number(
    (ingestedLengthData.data as Float64Array)[initTimeIndex],
  );
  if (!Number.isFinite(ingestedSeconds)) {
    throw new Error('Latest ECMWF initialization has no ingested forecast');
  }
  const firstUnavailableLead = allLeadHours.findIndex(
    (hours) => hours * 3600 > ingestedSeconds,
  );
  const ingestedLeadCount =
    firstUnavailableLead < 0 ? allLeadHours.length : firstUnavailableLead;
  const leadCount = Math.max(1, Math.min(shapedLeadCount, ingestedLeadCount));
  const leadHours = allLeadHours.slice(0, leadCount);

  const initSeconds = Number(
    (initData.data as BigInt64Array | bigint[])[initTimeIndex] ?? 0,
  );
  const validTimeMs = Array.from(
    {length: leadCount},
    (_, index) =>
      initSeconds * 1000 + (leadHours[index] ?? index) * 3600 * 1000,
  );

  const temperature = new Float32Array(leadCount * CELL_COUNT).fill(Number.NaN);
  const loaded = new Uint8Array(CELL_COUNT);
  const cube: TimeCube = {
    temperature,
    leadCount,
    cellCount: CELL_COUNT,
    leadHours,
    validTimeMs,
  };

  const rects = chunkRects(
    arr.chunks[arr.chunks.length - 1],
    arr.chunks[arr.chunks.length - 2],
  );
  let loadedChunks = 0;
  const done = Promise.all(
    rects.map(async (rect) => {
      const region = await zarr.get(arr, [
        initTimeIndex,
        null,
        ECMWF_ENSEMBLE_MEMBER,
        zarr.slice(rect.y0, rect.y1),
        zarr.slice(rect.x0, rect.x1),
      ]);
      const src = region.data as Float32Array;
      const width = rect.x1 - rect.x0;
      const height = rect.y1 - rect.y0;
      const col = rect.x0 - ECMWF_X_START;
      for (let lead = 0; lead < leadCount; lead += 1) {
        for (let row = 0; row < height; row += 1) {
          const from = (lead * height + row) * width;
          temperature.set(
            src.subarray(from, from + width),
            lead * CELL_COUNT +
              (rect.y0 - ECMWF_Y_START + row) * RASTER_WIDTH +
              col,
          );
        }
      }
      for (let row = 0; row < height; row += 1) {
        loaded.fill(
          1,
          (rect.y0 - ECMWF_Y_START + row) * RASTER_WIDTH + col,
          (rect.y0 - ECMWF_Y_START + row) * RASTER_WIDTH + col + width,
        );
      }
      loadedChunks += 1;
      onChunk(loadedChunks, rects.length);
    }),
  ).then(() => undefined);

  return {cube, loaded, totalChunks: rects.length, done};
}
