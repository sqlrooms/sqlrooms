import {WebMercatorViewport} from '@deck.gl/core';
import {
  escapeId,
  getColValAsNumber,
  quoteTableReference,
  useStoreWithDuckDb,
} from '@sqlrooms/duckdb';
import type {
  MosaicDashboardEntryType,
  MosaicDashboardPanelConfigType,
} from '@sqlrooms/mosaic';
import type {Table as ArrowTable} from 'apache-arrow';
import {useEffect, useMemo, useState, type RefObject} from 'react';
import {
  asDeckJsonMapConfig,
  resolveDeckMapDashboardDatasetSource,
  type DeckMapDashboardFitToDataConfig,
} from './dashboardConfig';
import type {DeckJsonMapHandle} from './types';

type DeckMapDashboardFitState = {
  key: string;
  didAutoFit: boolean;
  fitRequestVersion: number;
  handledFitRequestVersion: number;
};

function createInitialFitState(key: string): DeckMapDashboardFitState {
  return {
    key,
    didAutoFit: false,
    fitRequestVersion: 0,
    handledFitRequestVersion: 0,
  };
}

function isDeckMapFitToDataValid(
  fitToData: DeckMapDashboardFitToDataConfig | null | undefined,
): fitToData is DeckMapDashboardFitToDataConfig {
  return Boolean(fitToData?.dataset);
}

function resolveFitToData(
  fitToDataRaw: DeckMapDashboardFitToDataConfig | null,
  datasets: Record<string, unknown> | undefined,
  interaction: Record<string, unknown> | undefined,
  spec: unknown,
): DeckMapDashboardFitToDataConfig | null {
  if (!fitToDataRaw) return null;
  const dataset = (
    datasets as
      | Record<
          string,
          {geometryColumn?: string; source?: {sqlQuery?: string}} | undefined
        >
      | undefined
  )?.[fitToDataRaw.dataset];

  if (fitToDataRaw.longitudeColumn && fitToDataRaw.latitudeColumn) {
    return fitToDataRaw;
  }

  const geomCol = fitToDataRaw.geometryColumn ?? dataset?.geometryColumn;

  if (geomCol) {
    return {...fitToDataRaw, geometryColumn: geomCol};
  }

  const inter = interaction as
    | {longitudeColumn?: string; latitudeColumn?: string}
    | undefined;
  if (inter?.longitudeColumn && inter?.latitudeColumn) {
    return {
      ...fitToDataRaw,
      geometryColumn: undefined,
      longitudeColumn: inter.longitudeColumn,
      latitudeColumn: inter.latitudeColumn,
    };
  }

  // Detect H3 layer as last resort: check layers bound to this dataset
  // for hexagonColumn when no other bounds method is available.
  const specObj = spec as Record<string, unknown> | undefined;
  const specLayers = Array.isArray(specObj?.layers) ? specObj.layers : [];
  for (const layer of specLayers) {
    if (!layer || typeof layer !== 'object') continue;
    const binding = (layer as Record<string, unknown>)._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    if (binding?.dataset === fitToDataRaw.dataset && binding?.hexagonColumn) {
      return {
        ...fitToDataRaw,
        h3Column: binding.hexagonColumn as string,
      };
    }
  }

  // Strip unverifiable geometryColumn; the bounds query will use
  // DuckDB case-insensitive column resolution as a fallback.
  const {geometryColumn: _geom, ...safeConfig} = fitToDataRaw;
  void _geom;
  return safeConfig;
}

export function createDeckMapBoundsQuery(options: {
  source: {tableName?: string; sqlQuery?: string};
  fitToData: DeckMapDashboardFitToDataConfig;
}) {
  const {source, fitToData} = options;
  if (!isDeckMapFitToDataValid(fitToData)) {
    return null;
  }
  const baseSourceSql = source.sqlQuery
    ? `SELECT * FROM (${source.sqlQuery}) AS "__sqlrooms_dashboard_map_source"`
    : `SELECT * FROM ${quoteTableReference(source.tableName ?? '')}`;

  if (fitToData.h3Column) {
    const h3Col = escapeId(fitToData.h3Column);
    return `
      SELECT
        MIN(h3_cell_to_lng(${h3Col})) AS min_longitude,
        MIN(h3_cell_to_lat(${h3Col})) AS min_latitude,
        MAX(h3_cell_to_lng(${h3Col})) AS max_longitude,
        MAX(h3_cell_to_lat(${h3Col})) AS max_latitude
      FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_h3"
      WHERE ${h3Col} IS NOT NULL
    `;
  }

  if (fitToData.geometryColumn) {
    const geometryCol = escapeId(fitToData.geometryColumn);
    const isWkb =
      source.sqlQuery && source.sqlQuery.toLowerCase().includes('st_aswkb');
    const geomExpr = isWkb
      ? `ST_GeomFromWKB(${geometryCol})`
      : `${geometryCol}::GEOMETRY`;
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(${geomExpr}) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_geom"
        WHERE ${geometryCol} IS NOT NULL
      ) AS "__sqlrooms_dashboard_map_extent"
      WHERE extent IS NOT NULL
    `;
  }

  if (fitToData.longitudeColumn && fitToData.latitudeColumn) {
    const longitudeColumn = escapeId(fitToData.longitudeColumn);
    const latitudeColumn = escapeId(fitToData.latitudeColumn);
    return `
      SELECT
        ST_XMin(extent) AS min_longitude,
        ST_YMin(extent) AS min_latitude,
        ST_XMax(extent) AS max_longitude,
        ST_YMax(extent) AS max_latitude
      FROM (
        SELECT ST_Extent_Agg(ST_Point(${longitudeColumn}, ${latitudeColumn})) AS extent
        FROM (${baseSourceSql}) AS "__sqlrooms_dashboard_map_points"
        WHERE ${longitudeColumn} IS NOT NULL AND ${latitudeColumn} IS NOT NULL
      ) AS "__sqlrooms_dashboard_map_extent"
      WHERE extent IS NOT NULL
    `;
  }

  // Fallback: use DuckDB unquoted identifiers for case-insensitive resolution
  // of common coordinate column names (longitude, lat, etc.)
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

function readBoundsFromExtentResult(result: ArrowTable) {
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

function fitViewStateToBounds(options: {
  bounds: readonly [readonly [number, number], readonly [number, number]];
  width: number;
  height: number;
  padding?: number;
  maxZoom?: number;
}) {
  const {bounds, width, height, padding = 40, maxZoom = 18} = options;
  const viewport = new WebMercatorViewport({
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  });
  const fitted = viewport.fitBounds(
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

const deckMapDashboardFitRequestTarget = new EventTarget();

export function emitDeckMapDashboardFitRequest(panelId: string) {
  deckMapDashboardFitRequestTarget.dispatchEvent(
    new CustomEvent('fit-view', {detail: {panelId}}),
  );
}

/**
 * Manages the "fit to bounds" state machine for a deck map panel.
 * Handles auto-fit on mount, manual fit requests, and bounds query execution.
 */
export function useDeckMapFitToBounds(options: {
  panelId: string;
  dashboard: MosaicDashboardEntryType;
  panel: MosaicDashboardPanelConfigType;
  containerSize: {width: number; height: number};
  deckMapRef: RefObject<DeckJsonMapHandle | null>;
}) {
  const {panelId, dashboard, panel, containerSize, deckMapRef} = options;
  const mapConfig = asDeckJsonMapConfig(panel.config);
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);

  const fitToDataRaw = mapConfig?.fitToData ?? null;
  const fitToData: DeckMapDashboardFitToDataConfig | null = useMemo(
    () =>
      resolveFitToData(
        fitToDataRaw,
        mapConfig?.datasets,
        mapConfig?.interaction,
        mapConfig?.spec,
      ),
    [
      fitToDataRaw,
      mapConfig?.datasets,
      mapConfig?.interaction,
      mapConfig?.spec,
    ],
  );

  const fitToDataSource = useMemo(
    () =>
      fitToData
        ? resolveDeckMapDashboardDatasetSource({
            dashboard,
            panel,
            dataset: mapConfig?.datasets[fitToData.dataset],
          })
        : undefined,
    [dashboard, fitToData, mapConfig?.datasets, panel],
  );

  const fitToDataKey = useMemo(
    () =>
      fitToData && fitToDataSource
        ? JSON.stringify({
            source: fitToDataSource,
            fitToData,
            selectedTable: dashboard.selectedTable,
          })
        : null,
    [dashboard.selectedTable, fitToData, fitToDataSource],
  );

  const fitStateKey = useMemo(
    () => JSON.stringify({panelId, fitToDataKey}),
    [fitToDataKey, panelId],
  );

  const [fitState, setFitState] = useState<DeckMapDashboardFitState>(() =>
    createInitialFitState(fitStateKey),
  );

  const activeFitState =
    fitState.key === fitStateKey
      ? fitState
      : createInitialFitState(fitStateKey);
  const {didAutoFit, fitRequestVersion, handledFitRequestVersion} =
    activeFitState;

  // Listen for manual fit requests
  useEffect(() => {
    const handleFitRequest = (event: Event) => {
      const detail = (event as CustomEvent<{panelId?: string}>).detail;
      if (detail?.panelId === panelId) {
        setFitState((current) => {
          const scoped =
            current.key === fitStateKey
              ? current
              : createInitialFitState(fitStateKey);
          return {
            ...scoped,
            fitRequestVersion: scoped.fitRequestVersion + 1,
          };
        });
      }
    };

    deckMapDashboardFitRequestTarget.addEventListener(
      'fit-view',
      handleFitRequest,
    );
    return () => {
      deckMapDashboardFitRequestTarget.removeEventListener(
        'fit-view',
        handleFitRequest,
      );
    };
  }, [fitStateKey, panelId]);

  // Execute fit-to-bounds query
  useEffect(() => {
    const hasManualFitRequest = fitRequestVersion > handledFitRequestVersion;
    if (
      !isDeckMapFitToDataValid(fitToData) ||
      !fitToDataSource ||
      containerSize.width <= 0 ||
      containerSize.height <= 0 ||
      (!hasManualFitRequest && didAutoFit)
    ) {
      return;
    }

    let isCancelled = false;

    const fitToDataBounds = async () => {
      try {
        if (fitToData.h3Column) {
          try {
            await executeSql('INSTALL h3 FROM community');
          } catch {
            // May already be installed
          }
          try {
            await executeSql('LOAD h3');
          } catch {
            // May already be loaded
          }
        }
        const boundsQuery = createDeckMapBoundsQuery({
          source: fitToDataSource,
          fitToData,
        });
        if (!boundsQuery) return;

        const handle = await executeSql(boundsQuery);
        const result = handle ? await handle : null;
        if (isCancelled || !result) return;

        const bounds = readBoundsFromExtentResult(result);
        if (!bounds) {
          setFitState((current) => {
            const scoped =
              current.key === fitStateKey
                ? current
                : createInitialFitState(fitStateKey);
            return {
              ...scoped,
              didAutoFit: true,
              handledFitRequestVersion: fitRequestVersion,
            };
          });
          return;
        }

        const nextViewState = fitViewStateToBounds({
          bounds,
          width: containerSize.width,
          height: containerSize.height,
          padding: fitToData.padding,
          maxZoom: fitToData.maxZoom,
        });
        if (!isCancelled && deckMapRef.current) {
          deckMapRef.current.jumpTo(nextViewState);
        }
        setFitState((current) => {
          const scoped =
            current.key === fitStateKey
              ? current
              : createInitialFitState(fitStateKey);
          return {
            ...scoped,
            didAutoFit: true,
            handledFitRequestVersion: fitRequestVersion,
          };
        });
      } catch {
        if (!isCancelled) {
          setFitState((current) => {
            const scoped =
              current.key === fitStateKey
                ? current
                : createInitialFitState(fitStateKey);
            return {
              ...scoped,
              didAutoFit: true,
              handledFitRequestVersion: fitRequestVersion,
            };
          });
        }
      }
    };

    void fitToDataBounds();

    return () => {
      isCancelled = true;
    };
  }, [
    containerSize.height,
    containerSize.width,
    deckMapRef,
    didAutoFit,
    executeSql,
    fitRequestVersion,
    fitStateKey,
    fitToData,
    fitToDataSource,
    handledFitRequestVersion,
  ]);

  return {fitToData};
}
