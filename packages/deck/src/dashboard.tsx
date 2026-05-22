import {WebMercatorViewport} from '@deck.gl/core';
import type {ComponentProps} from 'react';
import type DeckGLReact from '@deck.gl/react';

type DeckProps = ComponentProps<typeof DeckGLReact>;
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
  type ChartDataPolicy,
  type ChartRuntimeIssue,
  type ChartRuntimeIssueContext,
  type ChartRuntimeIssueReporter,
  useMosaicClient,
  useStoreWithMosaicDashboard,
} from '@sqlrooms/mosaic';
import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import type {MosaicClient} from '@uwdata/mosaic-core';
import type {Selection} from '@uwdata/mosaic-core';
import type {Table as ArrowTable} from 'apache-arrow';
import {FocusIcon, MapIcon, SettingsIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DeckMapConfigPopoverEditor} from './DeckMapConfigPopoverEditor';
import {DeckJsonMap} from './DeckJsonMap';
import {MapSettingsPanel} from './MapSettings';
import {MosaicDashboardPanelLayout} from '@sqlrooms/mosaic';
import {
  asDeckJsonMapConfig,
  createDeckMapDashboardDatasetQuery,
  createDeckMapDashboardDatasets,
  DEFAULT_DECK_MAP_MAX_DATA_POINTS,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  resolveDeckMapDashboardDatasetSource,
  type DeckMapDashboardFitToDataConfig,
  type DeckMapDashboardDatasetClientState,
  type DeckMapDashboardDatasetConfig,
  type DeckMapDataPolicyOverride,
  type DeckMapDashboardInteractionConfig,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import {
  createDeckMapDashboardPanelConfigForTable,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
} from './mapConfigUtils';

function DeckMapRuntimeIssuePanel({issue}: {issue: ChartRuntimeIssue}) {
  const title =
    issue.kind === 'too-much-data'
      ? 'Too much data'
      : issue.kind === 'sql-error'
        ? 'Map query failed'
        : 'Unable to display map';

  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-4">
      <div className="mb-2 text-center font-semibold">{title}</div>
      <div className="text-center text-sm whitespace-pre-wrap">
        {issue.message}
      </div>
    </div>
  );
}

function resolveDeckMapDataPolicy(
  basePolicy: ChartDataPolicy,
  override: DeckMapDataPolicyOverride | undefined,
): ChartDataPolicy {
  if (!override) {
    return basePolicy;
  }
  if (override.disabled) {
    return {
      ...basePolicy,
      disabled: true,
    };
  }
  return {
    ...basePolicy,
    ...(override.maxRows !== undefined ? {maxRows: override.maxRows} : {}),
    ...(override.reason !== undefined ? {reason: override.reason} : {}),
  };
}

function DeckMapDashboardDatasetClient({
  dashboard,
  dataset,
  datasetId,
  dataPolicy,
  panel,
  onDatasetState,
  runtimeIssueContext,
  runtimeIssueReporter,
  selectionName,
}: {
  dashboard: MosaicDashboardEntryType;
  dataset: DeckMapDashboardDatasetConfig;
  datasetId: string;
  dataPolicy?: ChartDataPolicy | null;
  panel: MosaicDashboardPanelConfigType;
  onDatasetState: (
    datasetId: string,
    state: DeckMapDashboardDatasetClientState | undefined,
  ) => void;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
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
    dataPolicy,
    enabled: Boolean(source),
    runtimeIssueContext,
    runtimeIssueReporter,
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

  const isSettingsOpen = Boolean(mapConfig?.settingsOpen);

  const handleConfigApply = useCallback(
    (nextConfig: Record<string, unknown>) => {
      updatePanel(dashboardId, panel.id, {
        config: nextConfig,
      });
    },
    [dashboardId, panel.id, updatePanel],
  );

  const handleToggleSettings = useCallback(() => {
    updatePanel(dashboardId, panel.id, {
      config: {...panel.config, settingsOpen: !isSettingsOpen},
    });
  }, [dashboardId, isSettingsOpen, panel.config, panel.id, updatePanel]);

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="data-[state=active]:bg-accent h-6 w-6"
            title="Map settings"
            onClick={handleToggleSettings}
            data-state={isSettingsOpen ? 'active' : 'inactive'}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Map settings</TooltipContent>
      </Tooltip>
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
  dashboardId,
  panel,
  selectionName,
}: MosaicDashboardPanelRendererProps) {
  const mapConfig = asDeckJsonMapConfig(panel.config);
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const issue = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getPanelIssue(dashboardId, panel.id),
  );
  const reportPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.reportPanelIssue,
  );
  const clearPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.clearPanelIssue,
  );
  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);

  const isSettingsOpen = Boolean(
    (panel.config as DeckMapDashboardPanelConfig).settingsOpen,
  );

  const handleSettingsOpenChange = useCallback(
    (isOpen: boolean) => {
      updatePanel(dashboardId, panel.id, {
        config: {...panel.config, settingsOpen: isOpen},
      });
    },
    [dashboardId, panel.config, panel.id, updatePanel],
  );
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

  const dataPolicy = useMemo<ChartDataPolicy>(
    () =>
      resolveDeckMapDataPolicy(
        {
          maxRows: DEFAULT_DECK_MAP_MAX_DATA_POINTS,
          reason:
            'Map panels render source rows as interactive deck.gl features. Filter, aggregate, or switch to a smaller source query before rendering this map.',
        },
        mapConfig?.dataPolicy,
      ),
    [mapConfig?.dataPolicy],
  );
  const runtimeIssueContext = useMemo(
    () => ({
      panelId: panel.id,
      chartType: DECK_MAP_DASHBOARD_PANEL_TYPE,
    }),
    [panel.id],
  );
  const runtimeIssueReporter = useMemo<ChartRuntimeIssueReporter>(
    () => ({
      reportIssue: (issueToReport) => {
        reportPanelIssue(dashboardId, panel.id, issueToReport);
      },
      clearIssue: () => {
        clearPanelIssue(dashboardId, panel.id);
      },
    }),
    [clearPanelIssue, dashboardId, panel.id, reportPanelIssue],
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

  const settingsContent = (
    <MapSettingsPanel
      dashboardId={dashboardId}
      panel={panel}
      onClose={() => handleSettingsOpenChange(false)}
    />
  );

  const mapContent = !mapConfig ? (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
      Invalid map panel config.
    </div>
  ) : issue ? (
    <DeckMapRuntimeIssuePanel issue={issue} />
  ) : Object.entries(mapConfig.datasets).length === 0 ? (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
      Map panels require at least one dataset.
    </div>
  ) : (
    <div ref={containerRef} className="relative h-full w-full">
      {Object.entries(mapConfig.datasets).map(([datasetId, dataset]) => (
        <DeckMapDashboardDatasetClient
          key={datasetId}
          dashboard={dashboard}
          dataset={dataset}
          datasetId={datasetId}
          dataPolicy={dataPolicy}
          panel={panel}
          onDatasetState={handleDatasetState}
          runtimeIssueContext={runtimeIssueContext}
          runtimeIssueReporter={runtimeIssueReporter}
          selectionName={selectionName}
        />
      ))}
      {Object.entries(datasetStates)
        .filter(([, state]) => state.error)
        .map(([datasetId, state]) => (
          <div
            key={datasetId}
            className="bg-background/90 text-destructive absolute inset-x-4 top-4 z-10 rounded-md border p-3 text-sm shadow"
          >
            Failed to load dataset &quot;{datasetId}&quot;:{' '}
            {state.error?.message}
          </div>
        ))}
      <DeckJsonMap
        className="h-full w-full"
        spec={mapConfig.spec}
        datasets={
          mapConfig
            ? createDeckMapDashboardDatasets(mapConfig, datasetStates)
            : {}
        }
        mapStyle={mapConfig.mapStyle}
        mapProps={mapConfig.mapProps}
        showLegends={mapConfig.showLegends}
        deckProps={{
          controller: true,
          ...(viewState ? {viewState} : {}),
          onViewStateChange: handleViewStateChange,
          ...(mapConfig.interaction
            ? (mapConfig.interaction.event ?? 'hover') === 'click'
              ? {onClick: handleBrushEvent}
              : {onHover: handleBrushEvent}
            : {}),
        }}
      />
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <MosaicDashboardPanelLayout
        isOpen={isSettingsOpen}
        onIsOpenChange={handleSettingsOpenChange}
        settings={settingsContent}
        content={mapContent}
      />
    </div>
  );
}

export const deckMapDashboardPanelRenderer: MosaicDashboardPanelRenderer = {
  component: DeckMapDashboardRenderer,
  headerActions: DeckMapDashboardHeaderActions,
  icon: MapIcon,
};

export const deckMapDashboardAddPanelAction: import('@sqlrooms/mosaic').MosaicDashboardAddPanelAction =
  {
    type: DECK_MAP_DASHBOARD_PANEL_TYPE,
    label: 'Map',
    icon: MapIcon,
    isEnabled: ({selectedTable}) =>
      Boolean(
        findLongitudeLatitudeColumns(selectedTable) ??
        findGeometryColumn(selectedTable),
      ),
    createPanel: ({selectedTable}) =>
      selectedTable
        ? createDeckMapDashboardPanelConfigForTable({
            title: `${selectedTable.tableName} map`,
            tableName: selectedTable.tableName,
            columns: selectedTable.columns,
            tableReference: selectedTable.table,
          })
        : undefined,
  };
