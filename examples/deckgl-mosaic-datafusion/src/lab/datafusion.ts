import initDataFusion, {DataFusionContext} from '@dzole0311/datafusion-wasm';
import dataFusionWasmUrl from '@dzole0311/datafusion-wasm/datafusion_wasm_bg.wasm?url';
import {
  float32,
  tableFromArrays,
  tableFromIPC,
  tableToIPC,
  type DataType,
} from '@uwdata/flechette';
import {BOUNDS, ECMWF_RESOLUTION, RASTER_WIDTH, type QueryLog} from './types';
import type {TimeCube} from './zarr-cube';

export type QueryRequest = {
  type?: 'arrow' | 'json' | 'exec';
  sql: string;
};

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * SQL CASE expression shared by every query that assigns temperature
 * classes. The value column is coalesced upstream, so it is never NULL
 * when this expression runs.
 */
const CATEGORY_CASE =
  "CASE WHEN value < 0 THEN 'freezing' WHEN value < 10 THEN 'cool' WHEN value < 20 THEN 'mild' ELSE 'warm' END";

const CELL_AREA_EQUATOR_KM2 = (111.32 * ECMWF_RESOLUTION) ** 2;

/**
 * Static cell attributes derived from the lead-0 slice of cells_all_leads.
 * Grid position comes from the row id, lon/lat from the crop bounds with
 * the grid point at the cell center, area_km2 from the cos(latitude)
 * spherical cell area. NULL samples (NaN in the Zarr cube) fall back to 0.
 */
const CELLS_LEAD0_SQL = `SELECT id, x, y, lon, lat,
  ${CELL_AREA_EQUATOR_KM2} * COS(RADIANS(lat)) AS area_km2,
  value,
  ${CATEGORY_CASE} AS category
FROM (
  SELECT id, x, y,
    ${BOUNDS.west} + (CAST(x AS DOUBLE) + 0.5) * ${ECMWF_RESOLUTION} AS lon,
    ${BOUNDS.north} - (CAST(y AS DOUBLE) + 0.5) * ${ECMWF_RESOLUTION} AS lat,
    value
  FROM (
    SELECT id,
      id % ${RASTER_WIDTH} AS x,
      id / ${RASTER_WIDTH} AS y,
      CAST(COALESCE(temperature, 0) AS DOUBLE) AS value
    FROM cells_all_leads
    WHERE time_index = 0
  ) AS base
) AS geo
ORDER BY id`;

/**
 * Builds the SQL that recomputes the cells_current_lead table for an
 * integer forecast lead. NULL samples (NaN in the Zarr cube) fall back to
 * the lead-0 value.
 */
function currentLeadCellsSql(leadIndex: number) {
  if (leadIndex === 0) return 'SELECT * FROM cells_lead0';
  return `SELECT id, x, y, lon, lat, area_km2, value, ${CATEGORY_CASE} AS category
FROM (
  SELECT b.id AS id, b.x AS x, b.y AS y, b.lon AS lon, b.lat AS lat,
    b.area_km2 AS area_km2,
    COALESCE(CAST(t.temperature AS DOUBLE), b.value) AS value
  FROM cells_lead0 AS b
  LEFT JOIN (
    SELECT id, temperature FROM cells_all_leads WHERE time_index = ${leadIndex}
  ) AS t ON b.id = t.id
) AS lead`;
}

/**
 * Encodes the [lead][cell] temperature cube as an Arrow IPC long table with
 * columns (id, time_index, temperature). Cells whose store chunk has not
 * arrived yet, per the loaded mask, are omitted so partial data does not
 * skew the charts. Non-finite samples on loaded cells become Arrow nulls
 * so avg() and max() skip them.
 */
function cellsAllLeadsIpc(cube: TimeCube, loaded: Uint8Array) {
  let loadedCells = 0;
  for (let cell = 0; cell < cube.cellCount; cell += 1) {
    if (loaded[cell]) loadedCells += 1;
  }
  const total = cube.leadCount * loadedCells;
  const id = new Int32Array(total);
  const timeIndex = new Int32Array(total);
  const temperature: Array<number | null> = new Array(total);
  let row = 0;
  for (let t = 0; t < cube.leadCount; t += 1) {
    const offset = t * cube.cellCount;
    for (let cell = 0; cell < cube.cellCount; cell += 1) {
      if (!loaded[cell]) continue;
      id[row] = cell;
      timeIndex[row] = t;
      const value = cube.temperature[offset + cell];
      temperature[row] = Number.isFinite(value) ? value : null;
      row += 1;
    }
  }
  const table = tableFromArrays(
    {id, time_index: timeIndex, temperature},
    {types: {temperature: float32()} as Record<string, DataType>},
  );
  const bytes = tableToIPC(table, {format: 'stream'});
  if (!bytes) throw new Error('Arrow IPC encoding produced no bytes');
  return bytes;
}

function forecastTimesIpc(cube: TimeCube) {
  const table = tableFromArrays({
    time_index: Int32Array.from(cube.validTimeMs, (_, index) => index),
    valid_time_ms: Float64Array.from(cube.validTimeMs),
  });
  const bytes = tableToIPC(table, {format: 'stream'});
  if (!bytes) throw new Error('Arrow IPC encoding produced no bytes');
  return bytes;
}

/**
 * Mosaic schema introspection issues DESCRIBE queries and expects DuckDB
 * column type names. Maps Arrow type names onto them.
 */
function normalizeDescribeType(
  value: string | number | boolean | null | undefined,
) {
  const type = String(value ?? '').trim();
  const upper = type.toUpperCase();
  if (!type) return 'VARCHAR';
  if (upper === 'INT64' || upper === 'UINT64') return 'BIGINT';
  if (upper === 'INT32' || upper === 'UINT32') return 'INTEGER';
  if (upper === 'INT16' || upper === 'UINT16') return 'SMALLINT';
  if (upper === 'INT8' || upper === 'UINT8') return 'TINYINT';
  if (upper === 'FLOAT64') return 'DOUBLE';
  if (upper === 'FLOAT32') return 'REAL';
  if (upper.includes('UTF8')) return 'VARCHAR';
  if (upper.startsWith('TIMESTAMP')) return 'TIMESTAMP';
  if (upper.startsWith('DATE')) return 'DATE';
  if (upper === 'BOOL') return 'BOOLEAN';
  return upper;
}

function normalizeDescribeRows(rows: Row[]) {
  return rows.map((row) => {
    const columnType = row.column_type ?? row.data_type ?? row.type;
    const nullable = row.null ?? row.is_nullable ?? row.nullable;
    return {
      ...row,
      column_name: row.column_name ?? row.column ?? row.name,
      column_type: normalizeDescribeType(columnType),
      null:
        String(nullable ?? 'YES').toLowerCase() === 'no' || nullable === false
          ? 'NO'
          : 'YES',
    };
  });
}

export class DataFusion {
  private leadIndex = 0;

  private constructor(
    private readonly ctx: DataFusionContext,
    private readonly cube: TimeCube,
    private readonly onLog: (entry: QueryLog) => void,
  ) {}

  static async create(
    cube: TimeCube,
    loaded: Uint8Array,
    onLog: (entry: QueryLog) => void,
  ) {
    await initDataFusion(dataFusionWasmUrl);
    const ctx = DataFusionContext.new();
    ctx.register_ipc('cells_all_leads', cellsAllLeadsIpc(cube, loaded));
    ctx.register_ipc('forecast_times', forecastTimesIpc(cube));
    await ctx.materialize_table('cells_lead0', CELLS_LEAD0_SQL);
    await ctx.materialize_table(
      'cells_current_lead',
      'SELECT * FROM cells_lead0',
    );
    return new DataFusion(ctx, cube, onLog);
  }

  /**
   * Re-encodes the shared cube with the current chunk coverage and rebuilds
   * the derived tables. Called as each streamed Zarr chunk lands.
   */
  async refreshData(loaded: Uint8Array) {
    const started = performance.now();
    this.ctx.register_ipc(
      'cells_all_leads',
      cellsAllLeadsIpc(this.cube, loaded),
    );
    await this.ctx.materialize_table('cells_lead0', CELLS_LEAD0_SQL);
    await this.ctx.materialize_table(
      'cells_current_lead',
      currentLeadCellsSql(this.leadIndex),
    );
    this.onLog({
      backend: 'client-datafusion-wasm',
      type: 'exec',
      sql: 'Refresh cells_all_leads from streamed Zarr chunks',
      ms: performance.now() - started,
      rows: 0,
      ok: true,
    });
  }

  async setLead(leadIndex: number) {
    const started = performance.now();
    this.leadIndex = leadIndex;
    await this.ctx.materialize_table(
      'cells_current_lead',
      currentLeadCellsSql(leadIndex),
    );
    this.onLog({
      backend: 'client-datafusion-wasm',
      type: 'exec',
      sql: `Rematerialize cells_current_lead for ECMWF lead ${leadIndex}`,
      ms: performance.now() - started,
      rows: 0,
      ok: true,
    });
  }

  async query({type = 'arrow', sql}: QueryRequest): Promise<unknown> {
    const started = performance.now();
    try {
      let data: unknown;
      let rows = 0;
      if (type === 'exec') {
        await this.ctx.execute_sql(sql);
      } else {
        const bytes = (await this.ctx.execute_ipc(sql)) as
          | ArrayBuffer
          | Uint8Array;
        const table = tableFromIPC(bytes, {useDate: true});
        if (/^\s*(desc|describe)\b/i.test(sql)) {
          data = normalizeDescribeRows(table.toArray() as Row[]);
          rows = (data as Row[]).length;
        } else if (type === 'json') {
          data = table.toArray() as Row[];
          rows = (data as Row[]).length;
        } else {
          data = table;
          rows = table.numRows;
        }
      }
      this.onLog({
        backend: 'client-datafusion-wasm',
        type,
        sql,
        ms: performance.now() - started,
        rows,
        ok: true,
      });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.onLog({
        backend: 'client-datafusion-wasm',
        type,
        sql,
        ms: performance.now() - started,
        rows: 0,
        ok: false,
        error: message,
      });
      throw error instanceof Error ? error : new Error(message);
    }
  }
}
