/**
 * Central Europe crop centered on Switzerland, roughly Paris to Vienna and
 * Rome to Denmark: 64 x 0.25 = 16 degrees wide, 48 x 0.25 = 12 degrees tall.
 *
 * Index convention, verified against the store coordinate arrays:
 * longitude[i] = -180 + 0.25 * i, so X_START = (west + 180) / 0.25;
 * latitude[i] = 90 - 0.25 * i with the grid point on the south edge of the
 * cell, so Y_START = (90 - north) / 0.25 + 1.
 *
 * The crop spans a 3x3 block of the store's 32-cell inner chunks (chunk
 * columns 22..24, chunk rows 4..6), so one variable needs nine chunk
 * fetches of about 3 MB each; the streaming loader paints each chunk as
 * it arrives.
 */
export const RASTER_WIDTH = 64;
export const RASTER_HEIGHT = 48;
export const CELL_COUNT = RASTER_WIDTH * RASTER_HEIGHT;
export const ECMWF_RESOLUTION = 0.25;
export const ECMWF_X_START = 720;
export const ECMWF_Y_START = 149;

export const ECMWF_STORE_URL =
  'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/dynamical/ecmwf-ifs-ens-forecast-15-day-0-25-degree/v0.1.0.zarr';
export const ECMWF_TEMPERATURE_VARIABLE = 'temperature_2m';
export const ECMWF_ENSEMBLE_MEMBER = 0;

export const BOUNDS = {
  west: 0,
  east: 16,
  south: 41,
  north: 53,
};

export type QueryLog = {
  backend: string;
  type: string;
  sql: string;
  ms: number;
  rows: number;
  ok: boolean;
  error?: string;
};
