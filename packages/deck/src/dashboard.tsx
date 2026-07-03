import {
  column,
  type MosaicDashboardEntryType,
  type MosaicDashboardPanelConfigType,
  type MosaicDashboardPanelRenderer,
  type MosaicDashboardPanelRendererProps,
  sql,
  type ChartRuntimeIssue,
  type ChartRuntimeIssueContext,
  type ChartRuntimeIssueReporter,
  useMosaicClient,
  useStoreWithMosaicDashboard,
  usePanelClientRegistration,
} from '@sqlrooms/mosaic';
import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import type {MosaicClient} from '@uwdata/mosaic-core';
import type {Selection} from '@uwdata/mosaic-core';
import {AlertTriangleIcon, FocusIcon, MapIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DeckJsonMap} from './DeckJsonMap';
import type {DeckJsonMapHandle} from './types';
import {
  asDeckJsonMapConfig,
  createDeckMapDashboardPanelConfig,
  createDeckMapDashboardDatasetQuery,
  createDeckMapDashboardDatasets,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  DEFAULT_DECK_MAP_MAX_DATA_POINTS,
  isDeckMapDashboardSqlDatasetSource,
  isDeckMapDashboardTableDatasetSource,
  resolveDeckMapDashboardDatasetSource,
  type DeckMapDashboardFitToDataConfig,
  type DeckMapDashboardDatasetClientState,
  type DeckMapDashboardDatasetConfig,
  type DeckMapDashboardInteractionConfig,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import {
  useDeckMapFitToBounds,
  emitDeckMapDashboardFitRequest,
  createDeckMapBoundsQuery,
} from './useDeckMapFitToBounds';
export {createDeckMapBoundsQuery};
import {useDeckMapDatasets} from './useDeckMapDatasets';
import {DeckMapDashboardSettings} from './DashboardMapSettings';
import {
  createDeckMapDashboardPanelConfigForTable,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
} from './mapConfigUtils';

function createEmptyDeckMapDashboardPanelConfig(title = 'Map') {
  return createDeckMapDashboardPanelConfig({
    title,
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [],
    },
    datasets: {},
  });
}

/**
 * Extracts column names from common DuckDB "column not found" error messages
 * and layer geometry incompatibility errors.
 * Returns the column names if detected, or null for unrecognized errors.
 */
function parseMissingColumnsFromError(message: string): string[] | null {
  // "Referenced column "X" not found in FROM clause!" — may appear multiple times
  const refMatches = [
    ...message.matchAll(/Referenced column "([^"]+)" not found/gi),
  ];
  if (refMatches.length > 0) return refMatches.map((m) => m[1]!);

  // "Binder Error: Column "X" does not exist" or "column X not found"
  const colMatch = message.match(
    /(?:Column|column)\s+"([^"]+)"\s+(?:does not exist|not found)/i,
  );
  if (colMatch) return [colMatch[1]!];

  // "Geometry column "X" was not found"
  const geomNotFound = message.match(
    /Geometry column "([^"]+)" was not found/i,
  );
  if (geomNotFound) return [geomNotFound[1]!];

  return null;
}

/**
 * Detects geometry type mismatch errors (e.g. polygon layer on point data).
 */
function parseGeometryMismatchError(
  message: string,
): {required: string; found: string} | null {
  const match = message.match(
    /requires (\w+) geometry .+ but only (\w+) coordinates were found/i,
  );
  if (match) return {required: match[1]!, found: match[2]!};
  return null;
}

/**
 * Detects columns referenced in layer config that are missing from the loaded dataset.
 */
function detectMissingColumns(
  mapConfig: DeckMapDashboardPanelConfig | undefined,
  datasetStates: Record<string, DeckMapDashboardDatasetClientState>,
): string[] {
  if (!mapConfig?.spec) return [];
  const missing: string[] = [];
  const spec = mapConfig.spec as Record<string, unknown>;
  const layers = Array.isArray(spec.layers) ? spec.layers : [];

  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const layerObj = layer as Record<string, unknown>;
    const binding = layerObj._sqlroomsBinding as
      | Record<string, unknown>
      | undefined;
    const datasetId = binding?.dataset as string | undefined;
    const arrowTable = datasetId
      ? datasetStates[datasetId]?.arrowTable
      : undefined;
    if (!arrowTable) continue;

    const fieldNames = new Set(
      arrowTable.schema.fields.map((f) => f.name.toLowerCase()),
    );
    const check = (col: string | undefined) => {
      if (col && !fieldNames.has(col.toLowerCase())) {
        missing.push(col);
      }
    };

    // Check @@= accessors
    for (const [propName, propValue] of Object.entries(layerObj)) {
      // Skip elevation references when extrusion is disabled
      if (propName === 'getElevation' && !layerObj.extruded) continue;

      if (typeof propValue === 'string' && propValue.startsWith('@@=')) {
        const expression = propValue.slice(3).trim();
        if (/^[A-Za-z_$][\w$]*$/.test(expression)) {
          check(expression);
        }
      }
      // Check @@function colorScale/scale field references
      if (
        propValue &&
        typeof propValue === 'object' &&
        '@@function' in (propValue as object)
      ) {
        const fn = propValue as Record<string, unknown>;
        if (typeof fn.field === 'string') {
          check(fn.field);
        }
      }
    }
  }

  return [...new Set(missing)];
}

function DeckMapRuntimeIssuePanel({issue}: {issue: ChartRuntimeIssue}) {
  if (issue.kind === 'sql-error' || issue.kind === 'render-error') {
    const missingColumns = parseMissingColumnsFromError(issue.message);
    if (missingColumns) {
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-4">
          <div className="mb-2 text-center font-semibold">
            The visualization can&apos;t be displayed
          </div>
          <div className="text-center text-sm">
            <span>Selected columns are missing in the dataset: </span>
            {missingColumns.map((col, idx) => (
              <span key={idx}>
                <span className="inline-flex items-center rounded-md border border-gray-600 bg-gray-800 px-1 py-0.5 text-xs font-medium text-gray-300">
                  {col}
                </span>{' '}
              </span>
            ))}
          </div>
        </div>
      );
    }

    const geomMismatch = parseGeometryMismatchError(issue.message);
    if (geomMismatch) {
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-4">
          <div className="mb-2 text-center font-semibold">
            The visualization can&apos;t be displayed
          </div>
          <div className="text-center text-sm">
            This layer requires {geomMismatch.required} geometry, but the
            current dataset only has {geomMismatch.found} coordinates.
          </div>
        </div>
      );
    }
  }

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

function DeckMapDashboardDatasetClient({
  dashboard,
  dataset,
  datasetId,
  fitToData,
  panel,
  onDatasetState,
  runtimeIssueContext,
  runtimeIssueReporter,
  selectionName,
  maxRows,
}: {
  dashboard: MosaicDashboardEntryType;
  dataset: DeckMapDashboardDatasetConfig;
  datasetId: string;
  fitToData?: DeckMapDashboardFitToDataConfig;
  panel: MosaicDashboardPanelConfigType;
  onDatasetState: (
    datasetId: string,
    state: DeckMapDashboardDatasetClientState | undefined,
  ) => void;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
  selectionName: string;
  maxRows: number;
}) {
  const datasetFitToData = useMemo(
    () => (fitToData?.dataset === datasetId ? fitToData : undefined),
    [datasetId, fitToData],
  );
  const source = useMemo(
    () =>
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset,
        fitToData: datasetFitToData,
      }),
    [dashboard, dataset, datasetFitToData, panel],
  );
  const query = useCallback(
    (filter: unknown) =>
      source
        ? createDeckMapDashboardDatasetQuery(source, filter, {
            sampleRows: maxRows,
          })
        : createDeckMapDashboardDatasetQuery(
            {tableName: '__missing_dashboard_map_dataset__'},
            filter,
            {sampleRows: maxRows},
          ),
    [maxRows, source],
  );
  const queryError = useCallback(
    (err: Error) => {
      onDatasetState(datasetId, {
        arrowTable: undefined,
        error: err,
        isLoading: false,
        client: null,
        isSampled: false,
      });
    },
    [datasetId, onDatasetState],
  );
  const sourceKey = isDeckMapDashboardTableDatasetSource(source)
    ? source.tableName
    : isDeckMapDashboardSqlDatasetSource(source)
      ? ''
      : (dashboard.selectedTable ?? '');
  const sourceQueryKey = isDeckMapDashboardSqlDatasetSource(source)
    ? source.sqlQuery
    : isDeckMapDashboardTableDatasetSource(source)
      ? (source.transformSql ?? '')
      : '';
  const {data, error, isLoading, client} = useMosaicClient({
    id: `${panel.id}:${datasetId}:${sourceKey}:${sourceQueryKey}`,
    selectionName,
    query,
    queryError,
    enabled: Boolean(source),
    runtimeIssueContext,
    runtimeIssueReporter,
  });

  // Register client for panel reset button
  usePanelClientRegistration(dashboard.id, panel.id, client ? [client] : []);

  const isSampled = Boolean(data && data.numRows >= maxRows);

  useEffect(() => {
    onDatasetState(datasetId, {
      arrowTable: data ?? undefined,
      error,
      isLoading,
      client,
      isSampled,
    });

    return () => {
      onDatasetState(datasetId, undefined);
    };
  }, [client, data, datasetId, error, isLoading, isSampled, onDatasetState]);

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

function DeckMapDashboardHeaderActions({
  panel,
}: MosaicDashboardPanelRendererProps) {
  const mapConfig = asDeckJsonMapConfig(panel.config);
  const canFitView = Boolean(mapConfig?.fitToData);

  return (
    <div className="flex items-center gap-0.5">
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
  const isCustomMode = mapConfig?.configMode === 'custom';
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const issue = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getPanelIssue(dashboardId, panel.id),
  );
  const clearPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.clearPanelIssue,
  );

  // Clear runtime issues when the active table or panel config changes so
  // the map can recover (e.g., after switching tables or AI updating the map).
  useEffect(() => {
    clearPanelIssue(dashboardId, panel.id);
  }, [
    clearPanelIssue,
    dashboard.selectedTable,
    dashboardId,
    panel.config,
    panel.id,
  ]);

  const selection = useMemo<Selection>(
    () => getSelection(selectionName, 'crossfilter'),
    [getSelection, selectionName],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deckMapRef = useRef<DeckJsonMapHandle>(null);
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const [sampledDismissed, setSampledDismissed] = useState(false);

  const {
    datasetStates,
    handleDatasetState,
    runtimeIssueContext,
    runtimeIssueReporter,
    handleRenderingError,
  } = useDeckMapDatasets({dashboardId, panel});

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
  }, [issue]);

  const {fitToData} = useDeckMapFitToBounds({
    panelId: panel.id,
    dashboard,
    panel,
    containerSize,
    deckMapRef,
  });

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

  const datasetError = useMemo(() => {
    for (const state of Object.values(datasetStates)) {
      if (state.error) return state.error;
    }
    return undefined;
  }, [datasetStates]);

  const missingColumns = useMemo(
    () => detectMissingColumns(mapConfig ?? undefined, datasetStates),
    [mapConfig, datasetStates],
  );

  const maxRows =
    mapConfig?.dataPolicy?.maxRows ?? DEFAULT_DECK_MAP_MAX_DATA_POINTS;

  const mapContent = !mapConfig ? (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
      Invalid map panel config.
    </div>
  ) : Object.entries(mapConfig.datasets).length === 0 ? (
    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
      Map panels require at least one dataset.
    </div>
  ) : (
    <>
      {Object.entries(mapConfig.datasets).map(([datasetId, dataset]) => (
        <DeckMapDashboardDatasetClient
          key={datasetId}
          dashboard={dashboard}
          dataset={dataset}
          datasetId={datasetId}
          fitToData={fitToData ?? undefined}
          panel={panel}
          onDatasetState={handleDatasetState}
          runtimeIssueContext={runtimeIssueContext}
          runtimeIssueReporter={runtimeIssueReporter}
          selectionName={selectionName}
          maxRows={maxRows}
        />
      ))}
      {issue ? (
        <DeckMapRuntimeIssuePanel issue={issue} />
      ) : datasetError ? (
        <DeckMapRuntimeIssuePanel
          issue={{
            kind: 'sql-error',
            panelId: panel.id,
            chartType: DECK_MAP_DASHBOARD_PANEL_TYPE,
            message: datasetError.message,
            recoverable: true,
          }}
        />
      ) : (
        <div ref={containerRef} className="relative h-full w-full">
          {Object.values(datasetStates).some((s) => s.isSampled) &&
            !sampledDismissed && (
              <div className="bg-background/80 text-muted-foreground absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded px-2 py-1 text-xs shadow">
                <span>Data sampled to {maxRows.toLocaleString()} rows</span>
                <button
                  className="text-muted-foreground/60 hover:text-foreground -mr-0.5 ml-0.5"
                  onClick={() => setSampledDismissed(true)}
                >
                  ×
                </button>
              </div>
            )}
          {missingColumns.length > 0 && !isCustomMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`absolute left-2 z-10 flex h-5 w-5 items-center justify-center ${
                    Object.values(datasetStates).some((s) => s.isSampled) &&
                    !sampledDismissed
                      ? 'top-9'
                      : 'top-2'
                  }`}
                >
                  <AlertTriangleIcon className="h-4 w-4 text-amber-500 drop-shadow-sm" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs font-medium">Missing columns:</p>
                <p className="text-xs">{missingColumns.join(', ')}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <DeckJsonMap
            ref={deckMapRef}
            className="h-full w-full px-0.5 pb-0.5"
            spec={mapConfig.spec}
            datasets={
              mapConfig
                ? createDeckMapDashboardDatasets(mapConfig, datasetStates)
                : {}
            }
            mapStyle={mapConfig.mapStyle}
            mapProps={mapConfig.mapProps}
            showLegends={mapConfig.showLegends !== false}
            onRenderingError={handleRenderingError}
            deckProps={{
              controller: true,
              ...(mapConfig.interaction
                ? (mapConfig.interaction.event ?? 'hover') === 'click'
                  ? {onClick: handleBrushEvent}
                  : {onHover: handleBrushEvent}
                : {}),
            }}
          />
        </div>
      )}
    </>
  );

  return mapContent;
}

export const deckMapDashboardPanelRenderer: MosaicDashboardPanelRenderer = {
  component: DeckMapDashboardRenderer,
  headerActions: DeckMapDashboardHeaderActions,
  icon: MapIcon,
  settings: DeckMapDashboardSettings,
};

export const deckMapDashboardAddPanelAction: import('@sqlrooms/mosaic').MosaicDashboardAddPanelAction =
  {
    type: DECK_MAP_DASHBOARD_PANEL_TYPE,
    label: 'Map',
    icon: MapIcon,
    createPanel: ({selectedTable}) => {
      if (
        selectedTable &&
        (findLongitudeLatitudeColumns(selectedTable) ??
          findGeometryColumn(selectedTable))
      ) {
        return createDeckMapDashboardPanelConfigForTable({
          title: `${selectedTable.tableName} map`,
          tableName: selectedTable.tableName,
          columns: selectedTable.columns,
          tableReference: selectedTable.table,
        });
      }

      return createEmptyDeckMapDashboardPanelConfig(
        selectedTable ? `${selectedTable.tableName} map` : 'Map',
      );
    },
  };
