import {
  getTableIdentity,
  type DataTable,
  type DuckDbSliceState,
} from '@sqlrooms/duckdb';
import {useBlockSettingsStore} from '@sqlrooms/documents';
import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {FocusIcon, MapIcon, SlidersVerticalIcon} from 'lucide-react';
import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  DeckMapSurface,
  directDeckMapDataAdapter,
  type DeckMapDataAdapter,
} from './DeckMapSurface';
import {type DeckMapsSliceState, useStoreWithDeckMaps} from './DeckMapsSlice';
import {createEmptyDeckMapConfig} from './mapConfig';
import {
  createDeckMapConfigForTable,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
} from './mapConfigUtils';

type DeckMapResourceState = DeckMapsSliceState & DuckDbSliceState;

type DeckMapResourceErrorBoundaryProps = {
  children: ReactNode;
  onError: (error: Error) => void;
  resetKey: unknown;
};

type DeckMapResourceErrorBoundaryState = {
  error?: Error;
  resetKey: unknown;
};

class DeckMapResourceErrorBoundary extends Component<
  DeckMapResourceErrorBoundaryProps,
  DeckMapResourceErrorBoundaryState
> {
  state: DeckMapResourceErrorBoundaryState = {
    resetKey: this.props.resetKey,
  };
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  static getDerivedStateFromProps(
    props: DeckMapResourceErrorBoundaryProps,
    state: DeckMapResourceErrorBoundaryState,
  ) {
    return Object.is(props.resetKey, state.resetKey)
      ? null
      : {error: undefined, resetKey: props.resetKey};
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      '[DeckMapResourceErrorBoundary] Map render failed',
      error,
      errorInfo,
    );
    this.props.onError(error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="text-muted-foreground flex h-full min-h-[320px] items-center justify-center p-4 text-center text-sm">
          Map failed to render: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

/** Ensures a first-class map resource, optionally seeded from geospatial data. */
export function ensureDeckMapResourceState(
  state: DeckMapResourceState,
  mapId: string,
  title?: string,
) {
  if (state.deckMaps.getMap(mapId)) return;
  const table = state.db.tables.find(
    (candidate) =>
      Boolean(findLongitudeLatitudeColumns(candidate)) ||
      Boolean(findGeometryColumn(candidate)),
  );
  state.deckMaps.ensureMap(mapId, {
    title: title ?? 'Map',
    config: table
      ? createDeckMapConfigForTable({
          tableName: table.tableName,
          columns: table.columns,
          tableReference: table.table,
        })
      : createEmptyDeckMapConfig(),
  });
  if (table)
    state.deckMaps.setSelectedTable(mapId, getTableIdentity(table.table));
}

export type DeckMapBlockRendererProps = {
  mapId: string;
  title?: string;
  caption?: string;
  onCaptionChange?: (caption: string | undefined) => void;
  selected?: boolean;
  readOnly?: boolean;
  headerActions?: ReactNode;
  dataAdapter?: DeckMapDataAdapter;
};

/** Mosaic-free worksheet map renderer backed only by `deckMaps`. */
export function DeckMapBlockRenderer({
  mapId,
  title,
  caption,
  onCaptionChange,
  selected,
  readOnly,
  headerActions,
  dataAdapter = directDeckMapDataAdapter,
}: DeckMapBlockRendererProps) {
  const map = useStoreWithDeckMaps(
    (state) => state.deckMaps.config.mapsById[mapId],
  );
  const tables = useStoreWithDeckMaps((state) => state.db.tables);
  const ensureMap = useStoreWithDeckMaps((state) => state.deckMaps.ensureMap);
  const updateMap = useStoreWithDeckMaps((state) => state.deckMaps.updateMap);
  const setSelectedTable = useStoreWithDeckMaps(
    (state) => state.deckMaps.setSelectedTable,
  );
  const reportMapIssue = useStoreWithDeckMaps(
    (state) => state.deckMaps.reportMapIssue,
  );
  const clearMapIssue = useStoreWithDeckMaps(
    (state) => state.deckMaps.clearMapIssue,
  );
  const requestOpenSettingsPanel = useBlockSettingsStore(
    (state) => state.blockSettings.requestOpenSettingsPanel,
  );
  const requestCloseSettingsPanel = useBlockSettingsStore(
    (state) => state.blockSettings.requestCloseSettingsPanel,
  );
  const isSettingsPanelOpen = useBlockSettingsStore(
    (state) => state.blockSettings.runtime.isSettingsPanelOpen,
  );
  const isSettingsShown = Boolean(selected && isSettingsPanelOpen);
  const [fitRequestVersion, setFitRequestVersion] = useState(0);

  useEffect(() => {
    if (mapId && !map) ensureMap(mapId, {title: title ?? 'Embedded Map'});
  }, [ensureMap, map, mapId, title]);

  const handleTableChange = useCallback(
    (table: DataTable) => {
      setSelectedTable(mapId, getTableIdentity(table.table));
      const hasGeo =
        Boolean(findLongitudeLatitudeColumns(table)) ||
        Boolean(findGeometryColumn(table));
      updateMap(mapId, {
        config: hasGeo
          ? createDeckMapConfigForTable({
              tableName: table.tableName,
              columns: table.columns,
              tableReference: table.table,
            })
          : createEmptyDeckMapConfig(),
      });
    },
    [mapId, setSelectedTable, updateMap],
  );

  if (!map) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[320px] items-center justify-center">
        Preparing map...
      </div>
    );
  }
  const hasDatasets = Object.keys(map.config.datasets).length > 0;
  const canFitView = Boolean(map.config.fitToData && hasDatasets);
  const fitViewLabel = canFitView
    ? 'Fit map view to data'
    : 'Fit view unavailable for this map';
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MapIcon className="h-4 w-4 shrink-0" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={caption ?? map.title}
            readOnly={readOnly}
            placeholder={map.selectedTable ?? title ?? 'Map caption'}
            onChange={(event) =>
              onCaptionChange?.(event.target.value || undefined)
            }
          />
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex"
                tabIndex={canFitView ? undefined : 0}
                aria-label={canFitView ? undefined : fitViewLabel}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={fitViewLabel}
                  disabled={!canFitView}
                  onClick={() => setFitRequestVersion((version) => version + 1)}
                >
                  <FocusIcon className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{fitViewLabel}</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant={isSettingsShown ? 'secondary' : 'ghost'}
            size="icon"
            className="h-6 w-6"
            aria-label={
              isSettingsShown ? 'Close map settings' : 'Open map settings'
            }
            onClick={() =>
              isSettingsShown
                ? requestCloseSettingsPanel()
                : requestOpenSettingsPanel()
            }
          >
            <SlidersVerticalIcon className="h-3.5 w-3.5" />
          </Button>
          {headerActions}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {hasDatasets ? (
          <DeckMapResourceErrorBoundary
            resetKey={map.config}
            onError={(error) =>
              reportMapIssue(mapId, {
                kind: 'render-error',
                message: error.message,
                recoverable: true,
              })
            }
          >
            <DeckMapSurface
              mapId={mapId}
              map={map}
              readOnly={readOnly}
              selected={selected}
              onUpdateMap={(patch) => updateMap(mapId, patch)}
              onReportIssue={(issue) => reportMapIssue(mapId, issue)}
              onClearIssue={(kind) => clearMapIssue(mapId, kind)}
              fitRequestVersion={fitRequestVersion}
              dataAdapter={dataAdapter}
            />
          </DeckMapResourceErrorBoundary>
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center p-4">
            <select
              className="border-border bg-background rounded border px-3 py-2 text-sm"
              value={map.selectedTable ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                const table = tables.find(
                  (candidate) =>
                    getTableIdentity(candidate.table) === event.target.value,
                );
                if (table) handleTableChange(table);
              }}
            >
              <option value="">Select a table</option>
              {tables.map((table) => (
                <option
                  key={getTableIdentity(table.table)}
                  value={getTableIdentity(table.table)}
                >
                  {table.tableName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
