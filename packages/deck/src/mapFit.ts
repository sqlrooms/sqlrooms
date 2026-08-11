import {WebMercatorViewport} from '@deck.gl/core';
import {
  escapeId,
  getColValAsNumber,
  useStoreWithDuckDb,
} from '@sqlrooms/duckdb';
import type {Table as ArrowTable} from 'apache-arrow';
import {useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {
  DeckTableDatasetInvalidTableNameError,
  createDeckTableDatasetSql,
} from './datasets/tableDatasetSql';
import {
  isDeckMapSqlDatasetSource,
  type DeckMapConfig,
  type DeckMapDatasetSource,
  type DeckMapFitToDataConfig,
} from './mapConfig';
import {
  isSqlDatasetInput,
  isTableDatasetInput,
  type DeckDatasetInput,
  type DeckJsonMapHandle,
} from './types';

/**
 * Resolves the effective fit-to-data configuration for a Deck map.
 *
 * Explicit coordinate or geometry fields take precedence. Missing geometry and
 * H3 fields are inferred from dataset metadata, interaction configuration, and
 * layer bindings without consulting host-specific state.
 *
 * @param config - Durable Deck map configuration to inspect.
 * @returns A normalized fit configuration, or `null` when fitting is disabled.
 */
export function resolveDeckMapFitToData(
  config: DeckMapConfig | null | undefined,
): DeckMapFitToDataConfig | null {
  if (!config) return null;
  const fitToData = config.fitToData;
  if (!fitToData?.dataset) return null;
  if (fitToData.longitudeColumn && fitToData.latitudeColumn) return fitToData;
  if (fitToData.geometryColumns && fitToData.geometryColumns.length > 0) {
    return fitToData;
  }

  // Explicit fitToData.geometryColumn wins over inferred arc/H3 columns.
  if (fitToData.geometryColumn) {
    return fitToData;
  }

  const spec =
    typeof config.spec === 'string'
      ? undefined
      : (config.spec as Record<string, unknown>);
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];

  // Arc layers bind two geometry columns. Prefer both so fit-to-bounds covers
  // source AND target endpoints when fitToData did not name a single column.
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const layerRecord = layer as Record<string, unknown>;
    // Hidden layers must not drive fit — e.g. a stale/hidden H3 overlay would
    // otherwise win over visible point lon/lat interaction columns.
    if (layerRecord.visible === false) continue;
    const binding = layerRecord._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    if (binding?.dataset !== fitToData.dataset) continue;

    if (
      layerRecord['@@type'] === 'GeoArrowArcLayer' &&
      typeof binding.sourceGeometryColumn === 'string' &&
      binding.sourceGeometryColumn.trim() &&
      typeof binding.targetGeometryColumn === 'string' &&
      binding.targetGeometryColumn.trim()
    ) {
      return {
        ...fitToData,
        geometryColumns: [
          String(binding.sourceGeometryColumn),
          String(binding.targetGeometryColumn),
        ],
      };
    }
  }

  // Dataset default geometry wins over inferred H3.
  const dataset = config.datasets[fitToData.dataset];
  const geometryColumn = dataset?.geometryColumn;
  if (geometryColumn) return {...fitToData, geometryColumn};

  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const layerRecord = layer as Record<string, unknown>;
    if (layerRecord.visible === false) continue;
    const binding = layerRecord._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    if (binding?.dataset !== fitToData.dataset) continue;

    if (binding.hexagonColumn) {
      return {...fitToData, h3Column: String(binding.hexagonColumn)};
    }

    // Fall back to getHexagon: "@@=column" when hexagonColumn was omitted.
    if (layerRecord['@@type'] === 'GeoArrowH3HexagonLayer') {
      const getHexagon = layerRecord.getHexagon;
      if (typeof getHexagon === 'string') {
        const match = getHexagon.match(/^@@=(.+)$/);
        const column = match?.[1]?.trim();
        if (column) {
          return {...fitToData, h3Column: column};
        }
      }
    }
  }

  if (
    config.interaction?.longitudeColumn &&
    config.interaction.latitudeColumn
  ) {
    return {
      ...fitToData,
      longitudeColumn: config.interaction.longitudeColumn,
      latitudeColumn: config.interaction.latitudeColumn,
    };
  }

  return fitToData;
}

/**
 * Converts a host-resolved Deck dataset input into a queryable map source.
 *
 * Prepared Arrow datasets intentionally return `null` because fitting them
 * requires host-provided bounds rather than a DuckDB source query.
 *
 * @param dataset - Dataset after the host data adapter has resolved its source.
 * @returns A SQL or table source suitable for bounds queries, or `null`.
 */
export function getDeckMapDatasetSource(
  dataset: DeckDatasetInput | undefined,
): DeckMapDatasetSource | null {
  if (!dataset) return null;
  if (isSqlDatasetInput(dataset)) return {sqlQuery: dataset.sqlQuery};
  if (isTableDatasetInput(dataset)) {
    return {
      tableName: dataset.tableName,
      transformSql: dataset.transformSql,
    };
  }
  return null;
}

/**
 * Builds the DuckDB query used to calculate a map dataset's geographic extent.
 *
 * The query strategy follows the normalized fit configuration: H3 cells,
 * geometry values, explicit longitude/latitude columns, or conventional
 * `Longitude`/`Latitude` column names as a final fallback.
 *
 * @param options - Resolved dataset source and normalized fit configuration.
 * @returns SQL that yields min/max longitude and latitude, or `null` when the
 * configuration cannot identify a target dataset.
 */
export function createDeckMapBoundsQuery(options: {
  source: DeckMapDatasetSource;
  fitToData: DeckMapFitToDataConfig;
}) {
  const {source, fitToData} = options;
  if (!fitToData.dataset) return null;
  const baseSourceSql = isDeckMapSqlDatasetSource(source)
    ? `SELECT * FROM (${source.sqlQuery.trim().replace(/(?:\s*;+\s*)+$/, '')}) AS "__sqlrooms_dashboard_map_source"`
    : createDeckMapBoundsTableSourceSql(source);

  if (fitToData.h3Column) {
    const column = escapeId(fitToData.h3Column);
    // Pass the column through directly. DuckDB's h3_cell_to_* overloads accept
    // both VARCHAR hex indexes and BIGINT/UBIGINT cell IDs. Do NOT CAST to
    // VARCHAR — that turns numeric IDs into decimal text, which is not a valid
    // H3 string (use h3_h3_to_string only when an explicit hex string is needed).
    return `
      SELECT
        MIN(h3_cell_to_lng(${column})) AS min_longitude,
        MIN(h3_cell_to_lat(${column})) AS min_latitude,
        MAX(h3_cell_to_lng(${column})) AS max_longitude,
        MAX(h3_cell_to_lat(${column})) AS max_latitude
      FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_h3"
      WHERE ${column} IS NOT NULL
    `;
  }

  const geometryColumns =
    fitToData.geometryColumns && fitToData.geometryColumns.length > 0
      ? fitToData.geometryColumns
      : fitToData.geometryColumn
        ? [fitToData.geometryColumn]
        : null;

  if (geometryColumns) {
    const sourceSql = isDeckMapSqlDatasetSource(source)
      ? source.sqlQuery
      : (source.transformSql ?? '');
    const asGeometry = (column: string) =>
      sourceSql.toLowerCase().includes('st_aswkb')
        ? `ST_GeomFromWKB(${column})`
        : `${column}::GEOMETRY`;

    if (geometryColumns.length === 1) {
      const column = escapeId(geometryColumns[0]!);
      return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(${asGeometry(column)}) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_geom"
        WHERE ${column} IS NOT NULL
      ) AS "__sqlrooms_dashboard_map_extent"
      WHERE extent IS NOT NULL
    `;
    }

    // Multiple geometry columns (e.g. arc source + target): unnest all
    // geometries in one pass so the source is scanned once.
    const geomExprs = geometryColumns.map((col) => {
      const column = escapeId(col);
      return `CASE WHEN ${column} IS NOT NULL THEN ${asGeometry(column)} END`;
    });
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(geom) AS extent
        FROM (
          SELECT UNNEST([${geomExprs.join(', ')}]) AS geom
          FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_geom"
        ) AS "__sqlrooms_dashboard_map_geoms"
        WHERE geom IS NOT NULL
      ) AS "__sqlrooms_dashboard_map_extent"
      WHERE extent IS NOT NULL
    `;
  }

  if (fitToData.longitudeColumn && fitToData.latitudeColumn) {
    const longitude = escapeId(fitToData.longitudeColumn);
    const latitude = escapeId(fitToData.latitudeColumn);
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(ST_Point(${longitude}, ${latitude})) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_points"
        WHERE ${longitude} IS NOT NULL AND ${latitude} IS NOT NULL
      ) AS "__sqlrooms_dashboard_map_extent"
      WHERE extent IS NOT NULL
    `;
  }

  return `
    SELECT
      ST_XMin(extent) AS min_longitude,
      ST_YMin(extent) AS min_latitude,
      ST_XMax(extent) AS max_longitude,
      ST_YMax(extent) AS max_latitude
    FROM (
      SELECT ST_Extent_Agg(ST_Point(Longitude, Latitude)) AS extent
      FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_points"
      WHERE Longitude IS NOT NULL AND Latitude IS NOT NULL
    ) AS "__sqlrooms_dashboard_map_extent"
    WHERE extent IS NOT NULL
  `;
}

function createDeckMapBoundsTableSourceSql(
  source: Exclude<DeckMapDatasetSource, {sqlQuery: string}>,
) {
  try {
    return createDeckTableDatasetSql(source);
  } catch (error) {
    if (error instanceof DeckTableDatasetInvalidTableNameError) {
      throw new Error('Deck map fit-to-data requires a valid table source.');
    }
    throw error;
  }
}

function readDeckMapBounds(result: ArrowTable) {
  const minLongitude = getColValAsNumber(result, 'min_longitude');
  const minLatitude = getColValAsNumber(result, 'min_latitude');
  const maxLongitude = getColValAsNumber(result, 'max_longitude');
  const maxLatitude = getColValAsNumber(result, 'max_latitude');
  if (
    !Number.isFinite(minLongitude) ||
    !Number.isFinite(minLatitude) ||
    !Number.isFinite(maxLongitude) ||
    !Number.isFinite(maxLatitude)
  ) {
    return null;
  }
  return [
    [
      minLongitude === maxLongitude ? minLongitude - 0.01 : minLongitude,
      minLatitude === maxLatitude ? minLatitude - 0.01 : minLatitude,
    ],
    [
      minLongitude === maxLongitude ? maxLongitude + 0.01 : maxLongitude,
      minLatitude === maxLatitude ? maxLatitude + 0.01 : maxLatitude,
    ],
  ] as const;
}

function fitDeckMapView(options: {
  bounds: readonly [readonly [number, number], readonly [number, number]];
  width: number;
  height: number;
  padding?: number;
  maxZoom?: number;
}) {
  const {bounds, width, height, padding = 40, maxZoom = 18} = options;
  const fitted = new WebMercatorViewport({
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  }).fitBounds(
    [
      [bounds[0][0], bounds[0][1]],
      [bounds[1][0], bounds[1][1]],
    ],
    {padding},
  ) as WebMercatorViewport & {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  return {
    longitude: fitted.longitude,
    latitude: fitted.latitude,
    zoom: Math.min(fitted.zoom, maxZoom),
  };
}

/**
 * Builds MapLibre `jumpTo` options for a Deck map camera update.
 *
 * Pitch and bearing are omitted unless explicitly provided so callers that only
 * change lon/lat/zoom (notably fit-to-data) preserve a pitched
 * `initialViewState` — required for extruded ColumnLayer visibility.
 */
export function buildDeckMapJumpToOptions(opts: {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}): {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
} {
  const jumpOpts: {
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
  } = {
    center: [opts.longitude, opts.latitude],
    zoom: opts.zoom,
  };
  if (opts.bearing != null) jumpOpts.bearing = opts.bearing;
  if (opts.pitch != null) jumpOpts.pitch = opts.pitch;
  return jumpOpts;
}

type DeckMapFitState = {
  key: string;
  didAutoFit: boolean;
  handledRequestVersion: number;
};

function createInitialFitState(key: string, requestVersion: number) {
  return {
    key,
    didAutoFit: false,
    handledRequestVersion: requestVersion,
  };
}

/** Retries when H3 extension install/load races or bounds are briefly unavailable. */
const FIT_MAX_ATTEMPTS = 5;
const FIT_RETRY_DELAY_MS = 750;

/**
 * Executes host-neutral fit-to-data requests for a Deck map surface.
 *
 * The controller observes the map container, de-duplicates manual requests,
 * optionally auto-fits when the source changes, loads H3 support when needed,
 * queries dataset bounds, and updates the imperative Deck map view. Hosts are
 * responsible only for resolving their dataset source and request version.
 *
 * @param options - Map identity, resolved fit inputs, view refs, request state,
 * and optional success and error callbacks.
 */
export function useDeckMapFitController(options: {
  scopeId: string;
  fitToData: DeckMapFitToDataConfig | null;
  source: DeckMapDatasetSource | null;
  container: HTMLElement | null;
  deckMapRef: RefObject<DeckJsonMapHandle | null>;
  requestVersion: number;
  autoFit?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const {
    scopeId,
    fitToData,
    source,
    container,
    deckMapRef,
    requestVersion,
    autoFit = false,
    onSuccess,
    onError,
  } = options;
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const [retryNonce, setRetryNonce] = useState(0);
  const fitKey = useMemo(
    () => JSON.stringify({scopeId, fitToData, source}),
    [fitToData, scopeId, source],
  );
  const [fitState, setFitState] = useState<DeckMapFitState>(() =>
    createInitialFitState(fitKey, requestVersion),
  );
  // A source change resets auto-fit state, but must not mark a newer manual
  // request as handled before the effect observes it.
  const activeFitState =
    fitState.key === fitKey
      ? fitState
      : createInitialFitState(fitKey, fitState.handledRequestVersion);
  const fitAttemptsRef = useRef({key: '', count: 0});

  useEffect(() => {
    if (!container) return;
    const updateSize = () =>
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    // Reset retries when the dataset/source changes OR the user clicks Fit again
    // (requestVersion bumps). Otherwise a exhausted autofit leaves Fit no-oping.
    const attemptsKey = `${fitKey}:${requestVersion}`;
    if (fitAttemptsRef.current.key !== attemptsKey) {
      fitAttemptsRef.current = {key: attemptsKey, count: 0};
    }

    const hasManualRequest =
      requestVersion > activeFitState.handledRequestVersion;
    if (
      !fitToData ||
      !source ||
      containerSize.width <= 0 ||
      containerSize.height <= 0 ||
      (!hasManualRequest && (!autoFit || activeFitState.didAutoFit))
    ) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const markHandled = () =>
      setFitState({
        key: fitKey,
        didAutoFit: true,
        handledRequestVersion: requestVersion,
      });
    const scheduleRetry = (error?: Error) => {
      fitAttemptsRef.current.count += 1;
      if (fitAttemptsRef.current.count >= FIT_MAX_ATTEMPTS) {
        if (error) onError?.(error);
        markHandled();
        return;
      }
      retryTimer = setTimeout(() => {
        if (!cancelled) setRetryNonce((value) => value + 1);
      }, FIT_RETRY_DELAY_MS);
    };

    void (async () => {
      try {
        if (fitToData.h3Column) {
          try {
            await executeSql('INSTALL h3 FROM community');
          } catch {
            // The extension may already be installed.
          }
          await executeSql('LOAD h3');
        }
        const query = createDeckMapBoundsQuery({source, fitToData});
        if (!query) {
          markHandled();
          onSuccess?.();
          return;
        }
        const handle = await executeSql(query);
        const result = handle ? await handle : null;
        if (cancelled) return;
        if (!result) {
          // Empty handle is usually a closed/cancelled query, not a transient
          // race — fail once instead of scanning the table repeatedly.
          onError?.(
            new Error('Unable to fit map view to data: empty query result.'),
          );
          markHandled();
          return;
        }
        const bounds = readDeckMapBounds(result);
        if (!bounds) {
          // Empty / all-NULL geometry is a permanent data state, not a race.
          // Only H3 cold-start (extension load) is worth a limited retry.
          if (fitToData.h3Column) {
            scheduleRetry(
              new Error(
                'Unable to fit map view to H3 data. Check that the hexagon column contains valid H3 indexes.',
              ),
            );
            return;
          }
          onError?.(new Error('Unable to determine map bounds from data.'));
          markHandled();
          return;
        }
        deckMapRef.current?.jumpTo(
          fitDeckMapView({
            bounds,
            width: containerSize.width,
            height: containerSize.height,
            padding: fitToData.padding,
            maxZoom: fitToData.maxZoom,
          }),
        );
        markHandled();
        onSuccess?.();
      } catch (error) {
        if (cancelled) return;
        const fitError =
          error instanceof Error
            ? error
            : new Error('Unable to fit map view to data.');
        // Retry only likely-transient H3 extension load races. Deterministic
        // SQL errors (bad column, syntax) should fail immediately.
        const message = fitError.message.toLowerCase();
        const maybeTransientH3 =
          Boolean(fitToData.h3Column) &&
          (message.includes('h3') ||
            message.includes('extension') ||
            message.includes('not loaded') ||
            message.includes('catalog'));
        if (maybeTransientH3) {
          scheduleRetry(fitError);
          return;
        }
        onError?.(fitError);
        markHandled();
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    activeFitState.didAutoFit,
    activeFitState.handledRequestVersion,
    autoFit,
    containerSize.height,
    containerSize.width,
    deckMapRef,
    executeSql,
    fitKey,
    fitToData,
    onError,
    onSuccess,
    requestVersion,
    retryNonce,
    source,
  ]);
}
