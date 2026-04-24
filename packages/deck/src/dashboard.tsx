import {type DeckProps, WebMercatorViewport} from '@deck.gl/core';
import {
  escapeId,
  getColValAsNumber,
  useStoreWithDuckDb,
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
import type {MosaicClient} from '@uwdata/mosaic-core';
import type {Selection} from '@uwdata/mosaic-core';
import type {Table as ArrowTable} from 'apache-arrow';
import {MapIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DeckJsonMap} from './DeckJsonMap';
import type {DeckJsonMapProps} from './types';
import {
  asDeckJsonMapConfig,
  createDeckMapDashboardDatasetQuery,
  createDeckMapDashboardDatasets,
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
  );

  return {
    longitude: fitted.longitude,
    latitude: fitted.latitude,
    zoom: Math.min(fitted.zoom, maxZoom),
  };
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
  const [viewState, setViewState] = useState<DeckProps['viewState']>(null);
  const [didAutoFit, setDidAutoFit] = useState(false);

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

  const [prevFitKey, setPrevFitKey] = useState(fitToDataKey);
  const [prevPanelId, setPrevPanelId] = useState(panel.id);
  if (prevFitKey !== fitToDataKey || prevPanelId !== panel.id) {
    setPrevFitKey(fitToDataKey);
    setPrevPanelId(panel.id);
    setViewState(null);
    setDidAutoFit(false);
  }

  useEffect(() => {
    if (
      !fitToData ||
      !fitToDataSource ||
      didAutoFit ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
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
          setDidAutoFit(true);
          return;
        }

        setViewState(
          fitViewStateToBounds({
            bounds,
            width: containerSize.width,
            height: containerSize.height,
            padding: fitToData.padding,
            maxZoom: fitToData.maxZoom,
          }),
        );
        setDidAutoFit(true);
      } catch {
        if (!isCancelled) {
          setDidAutoFit(true);
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
    fitToData,
    fitToDataSource,
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
      viewState: NonNullable<DeckProps['viewState']>;
      interactionState?: Record<string, unknown>;
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

      setViewState(nextViewState);
      if (hasUserInteraction || didAutoFit || !fitToData) {
        setDidAutoFit(true);
      }
    },
    [didAutoFit, fitToData, viewState],
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
  icon: MapIcon,
};
