import * as vg from '@uwdata/vgplot';
import {coordinator, wasmConnector} from '@uwdata/mosaic-core';

export const brush = vg.Selection.crossfilter();

const PARQUET_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/earthquakes.parquet`
    : '';

let ready: Promise<void> | null = null;

export function initMosaic() {
  if (!ready) ready = setup();
  return ready;
}

async function setup() {
  const c = coordinator();

  try {
    c.databaseConnector(wasmConnector());
  } catch (_) {}

  if (PARQUET_URL) {
    await c.exec(`
      CREATE OR REPLACE TABLE earthquakes AS
      SELECT * REPLACE ("DateTime"::TIMESTAMP AS "DateTime")
      FROM read_parquet('${PARQUET_URL}')
    `);
  }
}
