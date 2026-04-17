/**
 * Earthquake slice: owns the active subduction-zone preset and drives the
 * cross-section slice filter.
 *
 * The slice keeps minimal state (active preset id + slice half-width) and
 * pushes derived SQL into the Cesium layer via `cesium.updateLayer()` so the
 * 3D view re-queries automatically. Pure SQL builders live at module scope
 * so the histogram panel can call them without a store subscription.
 */

import {createSlice, type StateCreator} from '@sqlrooms/room-shell';
import type {CesiumSliceState} from '@sqlrooms/cesium';
import {
  SUBDUCTION_PRESETS,
  DEFAULT_SLICE_HALF_WIDTH_KM,
  DATA_WIDTH_MULTIPLIER,
  buildSliceWhereClause,
  type SubductionPreset,
} from './earthquake-presets';

export const EARTHQUAKE_LAYER_ID = 'earthquakes';
export const EARTHQUAKE_TABLE = 'earthquakes';

/**
 * Magnitude bands used for both the 3D point coloring (via SQL CASE) and the
 * histogram stacks. Single source of truth so the legend and globe stay in
 * sync. Bands are listed low → high; `min` is inclusive.
 */
export const MAG_BANDS = [
  {key: 'mag5', min: 5, label: 'M 5–6', color: '#d0e4ff'},
  {key: 'mag6', min: 6, label: 'M 6–7', color: '#ffe680'},
  {key: 'mag7', min: 7, label: 'M 7–8', color: '#ffc04a'},
  {key: 'mag8', min: 8, label: 'M 8+', color: '#ff2a1f'},
] as const;

export type MagBandKey = (typeof MAG_BANDS)[number]['key'];

/** Lowest magnitude considered an "event" by both queries. */
const MAG_FLOOR = MAG_BANDS[0].min;
const BASE_FILTER = `mag >= ${MAG_FLOOR} AND depth IS NOT NULL`;

function composeWhere(whereFragment: string): string {
  return whereFragment ? `${BASE_FILTER} AND (${whereFragment})` : BASE_FILTER;
}

/**
 * SQL CASE expression that maps each row's magnitude to its band color.
 * Built from MAG_BANDS so the SQL palette and the legend always agree.
 */
function buildMagColorCase(): string {
  // Walk bands high → low so the first matching threshold wins.
  const branches = [...MAG_BANDS]
    .reverse()
    .map((b) => `WHEN e.mag >= ${b.min} THEN '${b.color}'`)
    .join(' ');
  return `CASE ${branches} ELSE '${MAG_BANDS[0].color}' END`;
}

/**
 * SQL CASE expression that buckets magnitude into a band key (mag4/mag5/...).
 * Mirrors buildMagColorCase so the histogram bins line up with the colors.
 */
function buildMagBandCase(): string {
  const branches = [...MAG_BANDS]
    .reverse()
    .map((b) => `WHEN mag >= ${b.min} THEN '${b.key}'`)
    .join(' ');
  return `CASE ${branches} ELSE '${MAG_BANDS[0].key}' END`;
}

/**
 * Base SQL query for the 3D earthquake layer.
 *
 * We join a per-dataset min/max time CTE so we can compute a "recency" score
 * in [0, 1] and scale point size by it. Altitude is negative depth (in
 * metres) so events sit at their true 3D position inside the Earth;
 * `depthTestAgainstTerrain = true` on the viewer means the globe occludes
 * them until a preset's section-cut clipping plane exposes the subsurface.
 */
export function buildEarthquakeSql(whereFragment: string): string {
  return `
    WITH stats AS (
      SELECT MIN(time) AS min_dt, MAX(time) AS max_dt
      FROM ${EARTHQUAKE_TABLE}
      WHERE mag >= ${MAG_FLOOR}
    )
    SELECT
      e.latitude AS latitude,
      e.longitude AS longitude,
      -e.depth * 1000.0 AS altitude_m,
      strftime(e.time, '%Y-%m-%dT%H:%M:%SZ') AS timestamp,
      ${buildMagColorCase()} AS color,
      (
        3.0 + 9.0 * COALESCE(
          (EPOCH(e.time) - EPOCH(s.min_dt))
            / NULLIF(EPOCH(s.max_dt) - EPOCH(s.min_dt), 0),
          0
        )
      ) AS size,
      'M' || CAST(ROUND(e.mag, 1) AS VARCHAR)
        || '  ·  ' || CAST(ROUND(e.depth, 0) AS VARCHAR) || ' km'
        || '  ·  ' || CAST(e.time AS VARCHAR) AS label
    FROM ${EARTHQUAKE_TABLE} e
    CROSS JOIN stats s
    WHERE ${composeWhere(whereFragment)}
    ORDER BY e.time
  `;
}

/**
 * Mag-vs-depth histogram SQL: 50 km depth bins pivoted into one column per
 * magnitude band. Output rows feed straight into a recharts stacked BarChart.
 */
export function buildHistogramSql(whereFragment: string): string {
  const sumCols = MAG_BANDS.map(
    (b) => `SUM(CASE WHEN mag_band = '${b.key}' THEN 1 ELSE 0 END) AS ${b.key}`,
  ).join(',\n      ');
  return `
    WITH bucketed AS (
      SELECT
        CAST(FLOOR(depth / 50) * 50 AS INTEGER) AS depth_bin,
        ${buildMagBandCase()} AS mag_band
      FROM ${EARTHQUAKE_TABLE}
      WHERE ${composeWhere(whereFragment)}
    )
    SELECT
      depth_bin,
      ${sumCols}
    FROM bucketed
    GROUP BY depth_bin
    ORDER BY depth_bin
  `;
}

/**
 * Compute the slab-filter WHERE fragment for the given preset + slab mesh
 * half-width. The SQL filter uses a data-point window that's
 * `DATA_WIDTH_MULTIPLIER` × wider than the mesh window, so the point cloud
 * has lateral context around the thin slab ribbon.
 */
export function whereFragmentFor(
  preset: SubductionPreset | null,
  slabHalfWidthKm: number,
): string {
  return preset
    ? buildSliceWhereClause(preset, slabHalfWidthKm * DATA_WIDTH_MULTIPLIER)
    : '';
}

export interface EarthquakeSliceState {
  earthquakes: {
    presets: SubductionPreset[];
    activePresetId: string | null;

    /**
     * Committed slice half-width — drives all SQL queries (Cesium layer +
     * histogram). Only updated on slider release.
     */
    sliceHalfWidthKm: number;
    /**
     * Live slider value — drives the label only. Decoupled from
     * sliceHalfWidthKm so dragging doesn't fire dozens of SQL re-queries.
     */
    pendingSliceHalfWidthKm: number;

    /** Live-update the slider position (label only, no SQL re-query). */
    setPendingSliceHalfWidthKm: (km: number) => void;
    /** Promote the pending value and push the new slab filter into Cesium. */
    commitSliceWidth: () => void;

    activatePreset: (presetId: string) => void;
    clearPreset: () => void;
  };
}

type StoreWithCesium = EarthquakeSliceState & CesiumSliceState;

export function createEarthquakeSlice(): StateCreator<EarthquakeSliceState> {
  return createSlice<EarthquakeSliceState, StoreWithCesium>((set, get) => {
    /** Push current committed slab filter into the Cesium layer. */
    const syncLayerSql = () => {
      const s = get().earthquakes;
      const preset = s.presets.find((p) => p.id === s.activePresetId) ?? null;
      const sql = buildEarthquakeSql(
        whereFragmentFor(preset, s.sliceHalfWidthKm),
      );
      get().cesium.updateLayer(EARTHQUAKE_LAYER_ID, {sqlQuery: sql});
    };

    return {
      earthquakes: {
        presets: SUBDUCTION_PRESETS,
        activePresetId: null,
        sliceHalfWidthKm: DEFAULT_SLICE_HALF_WIDTH_KM,
        pendingSliceHalfWidthKm: DEFAULT_SLICE_HALF_WIDTH_KM,

        activatePreset: (presetId: string) => {
          if (get().earthquakes.activePresetId === presetId) return;
          set((s) => ({
            earthquakes: {...s.earthquakes, activePresetId: presetId},
          }));
          syncLayerSql();
        },

        clearPreset: () => {
          if (get().earthquakes.activePresetId === null) return;
          set((s) => ({
            earthquakes: {...s.earthquakes, activePresetId: null},
          }));
          syncLayerSql();
        },

        setPendingSliceHalfWidthKm: (km: number) => {
          if (get().earthquakes.pendingSliceHalfWidthKm === km) return;
          set((s) => ({
            earthquakes: {...s.earthquakes, pendingSliceHalfWidthKm: km},
          }));
        },

        commitSliceWidth: () => {
          const s = get().earthquakes;
          if (s.sliceHalfWidthKm === s.pendingSliceHalfWidthKm) return;
          set((cur) => ({
            earthquakes: {
              ...cur.earthquakes,
              sliceHalfWidthKm: cur.earthquakes.pendingSliceHalfWidthKm,
            },
          }));
          if (get().earthquakes.activePresetId) syncLayerSql();
        },
      },
    };
  });
}
