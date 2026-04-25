import {WebMercatorViewport} from '@deck.gl/core';
import type {ComponentProps} from 'react';
import type DeckGLReact from '@deck.gl/react';

type DeckProps = ComponentProps<typeof DeckGLReact>;
import {
  escapeId,
  getColValAsNumber,
  useStoreWithDuckDb,
  type DataTable,
} from '@sqlrooms/duckdb';
import {
  column,
  type MosaicDashboardEntryType,
  type MosaicDashboardPanelConfigType,
  type MosaicDashboardPanelRenderer,
  type MosaicDashboardPanelRendererProps,
  sql,
  useMosaicClient,
  useStoreWithMosaicDashboard,
} from '@sqlrooms/mosaic';
import {Button} from '@sqlrooms/ui';
import type {MosaicClient} from '@uwdata/mosaic-core';
import type {Selection} from '@uwdata/mosaic-core';
import type {Table as ArrowTable} from 'apache-arrow';
import {FocusIcon, MapIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DeckMapConfigPopoverEditor} from './DeckMapConfigPopoverEditor';
import {DeckJsonMap} from './DeckJsonMap';
import type {DeckJsonMapProps} from './types';
import {
  asDeckJsonMapConfig,
  createDeckMapDashboardDatasetQuery,
  createDeckMapDashboardDatasets,
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  resolveDeckMapDashboardDatasetSource,
  type DeckMapDashboardFitToDataConfig,
  type DeckMapDashboardDatasetClientState,
  type DeckMapDashboardDatasetConfig,
  type DeckMapDashboardInteractionConfig,
} from './dashboardConfig';

function DeckMapDashboardDatasetClient({
  dashboard,
  dataset,
  datasetId,
  panel,
  onDatasetState,
  selectionName,
}: {
  dashboard: MosaicDashboardEntryType;
  dataset: DeckMapDashboardDatasetConfig;
  datasetId: string;
  panel: MosaicDashboardPanelConfigType;
  onDatasetState: (
    datasetId: string,
    state: DeckMapDashboardDatasetClientState | undefined,
  ) => void;
  selectionName: string;
}) {
  const source = useMemo(
    () =>
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset,
      }),
    [dashboard, dataset, panel],
  );
  const query = useCallback(
    (filter: unknown) =>
      source
        ? createDeckMapDashboardDatasetQuery(source, filter)
        : createDeckMapDashboardDatasetQuery(
            {tableName: '__missing_dashboard_map_dataset__'},
            filter,
          ),
    [source],
  );
  const {data, error, isLoading, client} = useMosaicClient({
    id: `${panel.id}:${datasetId}`,
    selectionName,
    query,
    enabled: Boolean(source),
  });

  useEffect(() => {
    onDatasetState(datasetId, {
      arrowTable: data ?? undefined,
      error,
      isLoading,
      client,
    });

    return () => {
      onDatasetState(datasetId, undefined);
    };
  }, [client, data, datasetId, error, isLoading, onDatasetState]);

  return null;
}

function createPointRadiusPredicate(
  interaction: DeckMapDashboardInteractionConfig,
  coordinate: [number, number],
) {
  const [longitude, latitude] = coordinate;
  const radiusMeters = interaction.radiusMeters ?? 500;
  const metersPerDegree = 111_320;
  const cosLatitude = Math.cos(latitude * (Math.PI / 180));
  const radiusSquared = radiusMeters * radiusMeters;

  return sql`(
    pow((${column(interaction.longitudeColumn)} - ${longitude}) * ${
      cosLatitude * metersPerDegree
    }, 2) +
    pow((${column(interaction.latitudeColumn)} - ${latitude}) * ${
      metersPerDegree
    }, 2)
  ) < ${radiusSquared}`;
}

type DeckMapInteractionEvent = {
  coordinate?: number[] | null;
  object?: unknown;
  index?: number;
  picked?: boolean;
};

function getCoordinate(
  info: DeckMapInteractionEvent,
): [number, number] | undefined {
  return info.coordinate && info.coordinate.length >= 2
    ? [info.coordinate[0]!, info.coordinate[1]!]
    : undefined;
}

function isPickedMapFeature(info: DeckMapInteractionEvent) {
  return Boolean(info.picked || info.object || (info.index ?? -1) >= 0);
}

function createDeckMapBoundsQuery(options: {
  source: {tableName?: string; sqlQuery?: string};
  fitToData: DeckMapDashboardFitToDataConfig;
}) {
  const {source, fitToData} = options;
  const baseSourceSql = source.sqlQuery
    ? `SELECT * FROM (${source.sqlQuery}) AS "__sqlrooms_dashboard_map_source"`
    : `SELECT * FROM ${(source.tableName ?? '')
        .split('.')
        .map(escapeId)
        .join('.')}`;
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
  const {bounds, width, height, padding = 40, maxZoom = 12} = options;
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
  ) as WebMercatorViewport & {longitude: number; latitude: number; zoom: number};

  return {
    longitude: fitted.longitude,
    latitude: fitted.latitude,
    zoom: Math.min(fitted.zoom, maxZoom),
  };
}

const deckMapDashboardFitRequestTarget = new EventTarget();

function emitDeckMapDashboardFitRequest(panelId: string) {
  deckMapDashboardFitRequestTarget.dispatchEvent(
    new CustomEvent('fit-view', {detail: {panelId}}),
  );
}

type DeckMapDashboardFitState = {
  key: string;
  viewState: DeckProps['viewState'];
  didAutoFit: boolean;
  fitRequestVersion: number;
  handledFitRequestVersion: number;
};

function createInitialDeckMapDashboardFitState(
  key: string,
): DeckMapDashboardFitState {
  return {
    key,
    viewState: undefined,
    didAutoFit: false,
    fitRequestVersion: 0,
    handledFitRequestVersion: 0,
  };
}

function DeckMapDashboardHeaderActions({
  dashboardId,
  panel,
}: MosaicDashboardPanelRendererProps) {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const mapConfig = asDeckJsonMapConfig(panel.config);
  const canFitView = Boolean(mapConfig?.fitToData);
  const handleConfigApply = useCallback(
    (nextConfig: Record<string, unknown>) => {
      updatePanel(dashboardId, panel.id, {
        config: nextConfig,
      });
    },
    [dashboardId, panel.id, updatePanel],
  );

  return (
    <div className="flex items-center gap-0.5">
      <DeckMapConfigPopoverEditor
        value={panel.config}
        onApply={handleConfigApply}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title={
          canFitView
            ? 'Fit map view to data'
            : 'Fit view unavailable for this map'
        }
        disabled={!canFitView}
        onClick={() => emitDeckMapDashboardFitRequest(panel.id)}
      >
        <FocusIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function DeckMapDashboardRenderer({
  dashboard,
  panel,
  selectionName,
}: MosaicDashboardPanelRendererProps) {
  const mapConfig = asDeckJsonMapConfig(panel.config);
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);
  const selection = useMemo<Selection>(
    () => getSelection(selectionName, 'crossfilter'),
    [getSelection, selectionName],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [datasetStates, setDatasetStates] = useState<
    Record<string, DeckMapDashboardDatasetClientState>
  >({});
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});

  const handleDatasetState = useCallback(
    (
      datasetId: string,
      state: DeckMapDashboardDatasetClientState | undefined,
    ) => {
      setDatasetStates((current) => {
        const next = {...current};
        if (state) {
          next[datasetId] = state;
        } else {
          delete next[datasetId];
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const deckDatasets = useMemo<DeckJsonMapProps['datasets']>(() => {
    if (!mapConfig) {
      return {};
    }

    return createDeckMapDashboardDatasets(mapConfig, datasetStates);
  }, [datasetStates, mapConfig]);
  const fitToData = mapConfig?.fitToData ?? null;
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
          })
        : null,
    [fitToData, fitToDataSource],
  );
  const fitStateKey = useMemo(
    () => JSON.stringify({panelId: panel.id, fitToDataKey}),
    [fitToDataKey, panel.id],
  );
  const [fitState, setFitState] = useState<DeckMapDashboardFitState>(() =>
    createInitialDeckMapDashboardFitState(fitStateKey),
  );
  const activeFitState =
    fitState.key === fitStateKey
      ? fitState
      : createInitialDeckMapDashboardFitState(fitStateKey);
  const {didAutoFit, fitRequestVersion, handledFitRequestVersion, viewState} =
    activeFitState;

  useEffect(() => {
    const handleFitRequest = (event: Event) => {
      const detail = (event as CustomEvent<{panelId?: string}>).detail;
      if (detail?.panelId === panel.id) {
        setFitState((current) => {
          const scoped =
            current.key === fitStateKey
              ? current
              : createInitialDeckMapDashboardFitState(fitStateKey);
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
  }, [fitStateKey, panel.id]);

  useEffect(() => {
    const hasManualFitRequest = fitRequestVersion > handledFitRequestVersion;
    if (
      !fitToData ||
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
        const handle = await executeSql(
          createDeckMapBoundsQuery({
            source: fitToDataSource,
            fitToData,
          }),
        );
        const result = handle ? await handle : null;
        if (isCancelled || !result) {
          return;
        }

        const bounds = readBoundsFromExtentResult(result);
        if (!bounds) {
          setFitState((current) => {
            const scoped =
              current.key === fitStateKey
                ? current
                : createInitialDeckMapDashboardFitState(fitStateKey);
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
        setFitState((current) => {
          const scoped =
            current.key === fitStateKey
              ? current
              : createInitialDeckMapDashboardFitState(fitStateKey);
          return {
            ...scoped,
            viewState: nextViewState,
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
                : createInitialDeckMapDashboardFitState(fitStateKey);
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
    didAutoFit,
    executeSql,
    fitRequestVersion,
    fitStateKey,
    fitToData,
    fitToDataSource,
    handledFitRequestVersion,
  ]);

  const handleBrushEvent = useCallback(
    (info: DeckMapInteractionEvent) => {
      const interaction = mapConfig?.interaction;
      if (!interaction) {
        return;
      }

      const client = datasetStates[interaction.dataset]?.client as
        | MosaicClient
        | null
        | undefined;
      if (!client) {
        return;
      }
      const coordinate = getCoordinate(info);
      if (!coordinate) {
        return;
      }
      if (interaction.event !== 'click' && !isPickedMapFeature(info)) {
        selection.reset(
          selection.clauses.filter((clause) => clause.source === client),
        );
        return;
      }

      const radiusMeters = interaction.radiusMeters ?? 500;
      selection.update({
        source: client,
        clients: new Set([client]),
        value: [coordinate[0], coordinate[1], radiusMeters],
        predicate: createPointRadiusPredicate(interaction, coordinate),
      });
    },
    [datasetStates, mapConfig?.interaction, selection],
  );

  const handleViewStateChange = useCallback(
    ({
      viewState: nextViewState,
      interactionState,
    }: {
      viewState: any;
      interactionState?: any;
    }) => {
      const hasUserInteraction = Boolean(
        interactionState &&
        ['isDragging', 'isPanning', 'isRotating', 'isZooming'].some((key) =>
          Boolean(interactionState[key]),
        ),
      );
      if (
        fitToData &&
        !didAutoFit &&
        viewState === null &&
        !hasUserInteraction
      ) {
        return;
      }

      setFitState((current) => {
        const scoped =
          current.key === fitStateKey
            ? current
            : createInitialDeckMapDashboardFitState(fitStateKey);
        return {
          ...scoped,
          viewState: nextViewState,
          didAutoFit: hasUserInteraction || scoped.didAutoFit || !fitToData,
        };
      });
    },
    [didAutoFit, fitStateKey, fitToData, viewState],
  );

  if (!mapConfig) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Invalid map panel config.
      </div>
    );
  }

  const datasetEntries = Object.entries(mapConfig.datasets);
  if (!datasetEntries.length) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Map panels require at least one dataset.
      </div>
    );
  }
  const datasetErrors = Object.entries(datasetStates).filter(
    ([, state]) => state.error,
  );

  const interactionEvent = mapConfig.interaction?.event ?? 'hover';
  const interactionDeckProps: DeckJsonMapProps['deckProps'] =
    mapConfig.interaction
      ? interactionEvent === 'click'
        ? {onClick: handleBrushEvent}
        : {onHover: handleBrushEvent}
      : {};

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {datasetEntries.map(([datasetId, dataset]) => (
        <DeckMapDashboardDatasetClient
          key={datasetId}
          dashboard={dashboard}
          dataset={dataset}
          datasetId={datasetId}
          panel={panel}
          onDatasetState={handleDatasetState}
          selectionName={selectionName}
        />
      ))}
      {datasetErrors.length ? (
        <div className="bg-background/90 text-destructive absolute inset-x-4 top-4 z-10 rounded-md border p-3 text-sm shadow">
          {datasetErrors.map(([datasetId, state]) => (
            <div key={datasetId}>
              Failed to load dataset &quot;{datasetId}&quot;:{' '}
              {state.error?.message}
            </div>
          ))}
        </div>
      ) : null}
      <DeckJsonMap
        className="h-full w-full"
        spec={mapConfig.spec}
        datasets={deckDatasets}
        mapStyle={mapConfig.mapStyle}
        mapProps={mapConfig.mapProps}
        showLegends={mapConfig.showLegends}
        deckProps={{
          controller: true,
          ...(viewState ? {viewState} : {}),
          onViewStateChange: handleViewStateChange,
          ...interactionDeckProps,
        }}
      />
    </div>
  );
}

export const deckMapDashboardPanelRenderer: MosaicDashboardPanelRenderer = {
  component: DeckMapDashboardRenderer,
  headerActions: DeckMapDashboardHeaderActions,
  icon: MapIcon,
};

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];

function findColumnByName(
  table: DataTable,
  candidates: string[],
) {
  const candidateSet = new Set(candidates);
  return table.columns.find((column) =>
    candidateSet.has(column.name.toLowerCase()),
  )?.name;
}

function findLongitudeLatitudeColumns(
  table?: DataTable,
) {
  if (!table) return null;
  const longitudeColumn = findColumnByName(table, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn = findColumnByName(table, LATITUDE_COLUMN_NAMES);
  return longitudeColumn && latitudeColumn
    ? {longitudeColumn, latitudeColumn}
    : null;
}

function quoteSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteTableReference(table: DataTable) {
  const qualifiedName = table.table;
  return [qualifiedName.database, qualifiedName.schema, qualifiedName.table]
    .filter((part): part is string => Boolean(part))
    .map(quoteSqlIdentifier)
    .join('.');
}

function createDeckMapPanelForTable(
  table: DataTable,
) {
  const coordinates = findLongitudeLatitudeColumns(table);
  if (!coordinates) return undefined;

  const {longitudeColumn, latitudeColumn} = coordinates;
  const datasetId = table.tableName;
  const geometryColumn = '__sqlrooms_geom';
  const quotedLongitude = quoteSqlIdentifier(longitudeColumn);
  const quotedLatitude = quoteSqlIdentifier(latitudeColumn);

  return createDeckMapDashboardPanelConfig({
    title: `${table.tableName} map`,
    source: {tableName: table.tableName},
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: datasetId,
          _sqlroomsBinding: {dataset: datasetId},
          filled: true,
          stroked: false,
          pickable: true,
          radiusUnits: 'pixels',
          getRadius: 4,
          getFillColor: [56, 189, 248, 180],
        },
      ],
    },
    datasets: {
      [datasetId]: {
        source: {
          sqlQuery: [
            `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteSqlIdentifier(geometryColumn)}`,
            `FROM ${quoteTableReference(table)}`,
            `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
          ].join(' '),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
    fitToData: {
      dataset: datasetId,
      longitudeColumn,
      latitudeColumn,
      padding: 40,
      maxZoom: 12,
    },
  });
}

export const deckMapDashboardAddPanelAction: import('@sqlrooms/mosaic').MosaicDashboardAddPanelAction =
  {
    type: DECK_MAP_DASHBOARD_PANEL_TYPE,
    label: 'Map',
    icon: MapIcon,
    isEnabled: ({selectedTable}) =>
      Boolean(findLongitudeLatitudeColumns(selectedTable)),
    createPanel: ({selectedTable}) =>
      selectedTable ? createDeckMapPanelForTable(selectedTable) : undefined,
  };
