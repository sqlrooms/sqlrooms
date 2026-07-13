import {WebMercatorViewport} from '@deck.gl/core';
import {
  escapeId,
  getColValAsNumber,
  useStoreWithDuckDb,
} from '@sqlrooms/duckdb';
import type {Table as ArrowTable} from 'apache-arrow';
import {
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
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

  const dataset = config.datasets[fitToData.dataset];
  const geometryColumn = fitToData.geometryColumn ?? dataset?.geometryColumn;
  if (geometryColumn) return {...fitToData, geometryColumn};

  if (config.interaction?.longitudeColumn && config.interaction.latitudeColumn) {
    return {
      ...fitToData,
      longitudeColumn: config.interaction.longitudeColumn,
      latitudeColumn: config.interaction.latitudeColumn,
    };
  }

  const spec =
    typeof config.spec === 'string'
      ? undefined
      : (config.spec as Record<string, unknown>);
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const binding = (layer as Record<string, unknown>)._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    if (binding?.dataset === fitToData.dataset && binding.hexagonColumn) {
      return {...fitToData, h3Column: String(binding.hexagonColumn)};
    }
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
    ? `SELECT * FROM (${source.sqlQuery}) AS "__sqlrooms_dashboard_map_source"`
    : createDeckMapBoundsTableSourceSql(source);

  if (fitToData.h3Column) {
    const column = escapeId(fitToData.h3Column);
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

  if (fitToData.geometryColumn) {
    const column = escapeId(fitToData.geometryColumn);
    const sourceSql = isDeckMapSqlDatasetSource(source)
      ? source.sqlQuery
      : (source.transformSql ?? '');
    const geometry = sourceSql.toLowerCase().includes('st_aswkb')
      ? `ST_GeomFromWKB(${column})`
      : `${column}::GEOMETRY`;
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(${geometry}) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_geom"
        WHERE ${column} IS NOT NULL
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

/**
 * Executes host-neutral fit-to-data requests for a Deck map surface.
 *
 * The controller observes the map container, de-duplicates manual requests,
 * optionally auto-fits when the source changes, loads H3 support when needed,
 * queries dataset bounds, and updates the imperative Deck map view. Hosts are
 * responsible only for resolving their dataset source and request version.
 *
 * @param options - Map identity, resolved fit inputs, view refs, request state,
 * and optional error reporting callback.
 */
export function useDeckMapFitController(options: {
  scopeId: string;
  fitToData: DeckMapFitToDataConfig | null;
  source: DeckMapDatasetSource | null;
  container: HTMLElement | null;
  deckMapRef: RefObject<DeckJsonMapHandle | null>;
  requestVersion: number;
  autoFit?: boolean;
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
    onError,
  } = options;
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const fitKey = useMemo(
    () => JSON.stringify({scopeId, fitToData, source}),
    [fitToData, scopeId, source],
  );
  const [fitState, setFitState] = useState<DeckMapFitState>(() =>
    createInitialFitState(fitKey, requestVersion),
  );
  const activeFitState =
    fitState.key === fitKey
      ? fitState
      : createInitialFitState(fitKey, requestVersion);

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
    const markHandled = () =>
      setFitState({
        key: fitKey,
        didAutoFit: true,
        handledRequestVersion: requestVersion,
      });

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
          return;
        }
        const handle = await executeSql(query);
        const result = handle ? await handle : null;
        if (cancelled || !result) return;
        const bounds = readDeckMapBounds(result);
        if (bounds) {
          deckMapRef.current?.jumpTo(
            fitDeckMapView({
              bounds,
              width: containerSize.width,
              height: containerSize.height,
              padding: fitToData.padding,
              maxZoom: fitToData.maxZoom,
            }),
          );
        }
        markHandled();
      } catch (error) {
        if (cancelled) return;
        const fitError =
          error instanceof Error
            ? error
            : new Error('Unable to fit map view to data.');
        onError?.(fitError);
        markHandled();
      }
    })();

    return () => {
      cancelled = true;
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
    requestVersion,
    source,
  ]);
}
