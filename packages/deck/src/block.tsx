import {
  BlockCaptionEditor,
  DataTableSelectorEmptyState,
  getMosaicDashboardSelectionName,
  type MosaicDashboardStoreState,
  useTablesWithColumns,
  useStoreWithMosaicDashboard,
} from '@sqlrooms/mosaic';
import {useBlockSettingsStore} from '@sqlrooms/documents';
import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import {MapIcon, SlidersVerticalIcon} from 'lucide-react';
import {Button} from '@sqlrooms/ui';
import {useCallback, useEffect, useMemo} from 'react';
import type React from 'react';
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
} from './dashboardConfig';
import {deckMapDashboardPanelRenderer} from './dashboard';
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
 * Ensures persisted map block state exists for an embeddable map surface.
 * If a geospatial table is available, the block is seeded with a starter map.
 */
export function ensureDeckMapBlockState(
  state: MosaicDashboardStoreState,
  mapId: string,
  title: string,
) {
  state.mosaicDashboard.ensureDashboard(mapId, title, 'grid');

  const dashboard = state.mosaicDashboard.getDashboard(mapId);
  if (
    !dashboard ||
    dashboard.panels.some(
      (panel) => panel.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
    )
  ) {
    return;
  }

  const table = state.db.tables.find(
    (candidate) =>
      Boolean(findLongitudeLatitudeColumns(candidate)) ||
      Boolean(findGeometryColumn(candidate)),
  );

  if (table) {
    state.mosaicDashboard.setSelectedTable(
      mapId,
      getTableIdentity(table.table),
    );
    state.mosaicDashboard.addPanel(
      mapId,
      createDeckMapDashboardPanelConfigForTable({
        title: `${table.tableName} map`,
        tableName: table.tableName,
        columns: table.columns,
        tableReference: table.table,
      }),
    );
    return;
  }

  state.mosaicDashboard.addPanel(
    mapId,
    createEmptyDeckMapDashboardPanelConfig(title),
  );
}

/** Props for rendering an embeddable Deck map block. */
export type DeckMapBlockRendererProps = {
  /** Durable map block id used to store backing Mosaic dashboard state. */
  mapId: string;
  /** Display title used when initializing empty map state. */
  title?: string;
  /** Optional header text that overrides the title when rendering. */
  caption?: string;
  /** Callback when caption changes. */
  onCaptionChange?: (caption: string | undefined) => void;
  /** Whether the containing document block is selected. */
  selected?: boolean;
  /** Whether the block is read-only. */
  readOnly?: boolean;
  /** Optional actions rendered in the map header before the settings button. */
  headerActions?: React.ReactNode;
};

/**
 * Renders an embeddable Deck map block backed by SQLRooms map panel state.
 */
export function DeckMapBlockRenderer({
  mapId,
  title,
  caption,
  onCaptionChange,
  selected,
  readOnly,
  headerActions,
}: DeckMapBlockRendererProps) {
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[mapId],
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);
  const tablesWithColumns = useTablesWithColumns();
  const ensureDashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.ensureDashboard,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const addPanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanel,
  );
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
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

  useEffect(() => {
    if (!mapId) {
      return;
    }

    ensureDashboard(mapId, title ?? 'Embedded Map', 'grid');
  }, [ensureDashboard, mapId, title]);

  useEffect(() => {
    if (!mapId || !dashboard) {
      return;
    }
    if (
      dashboard.panels.some(
        (panel) => panel.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
      )
    ) {
      return;
    }

    const table = tables.find(
      (candidate) =>
        Boolean(findLongitudeLatitudeColumns(candidate)) ||
        Boolean(findGeometryColumn(candidate)),
    );

    if (table) {
      setSelectedTable(mapId, getTableIdentity(table.table));
      addPanel(
        mapId,
        createDeckMapDashboardPanelConfigForTable({
          title: `${table.tableName} map`,
          tableName: table.tableName,
          columns: table.columns,
          tableReference: table.table,
        }),
      );
      return;
    }

    addPanel(
      mapId,
      createEmptyDeckMapDashboardPanelConfig(title ?? 'Embedded Map'),
    );
  }, [addPanel, dashboard, mapId, setSelectedTable, tables, title]);

  const panel = useMemo(
    () =>
      dashboard?.panels.find(
        (candidate) => candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
      ),
    [dashboard?.panels],
  );
  const selectedTable = useMemo(
    () =>
      tablesWithColumns.find(
        (table) => getTableIdentity(table.table) === dashboard?.selectedTable,
      ),
    [dashboard?.selectedTable, tablesWithColumns],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (!mapId || !panel) {
        return;
      }

      setSelectedTable(mapId, getTableIdentity(table.table));
      const hasGeospatialColumns =
        Boolean(findLongitudeLatitudeColumns(table)) ||
        Boolean(findGeometryColumn(table));
      const nextPanel = hasGeospatialColumns
        ? createDeckMapDashboardPanelConfigForTable({
            title: `${table.tableName} map`,
            tableName: table.tableName,
            columns: table.columns,
            tableReference: table.table,
          })
        : createEmptyDeckMapDashboardPanelConfig(title ?? 'Embedded Map');
      updatePanel(mapId, panel.id, {
        title: nextPanel.title,
        type: nextPanel.type,
        config: nextPanel.config,
      });
    },
    [mapId, panel, setSelectedTable, title, updatePanel],
  );
  const handleSettingsClick = useCallback(() => {
    if (isSettingsShown) {
      requestCloseSettingsPanel();
      return;
    }

    requestOpenSettingsPanel();
  }, [isSettingsShown, requestCloseSettingsPanel, requestOpenSettingsPanel]);

  if (!dashboard || !panel) {
    return (
      <div className="bg-muted/10 flex h-full min-h-[320px] flex-col">
        <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm font-medium">
          <MapIcon className="h-4 w-4" />
          <span>{title || 'Embedded Map'}</span>
        </div>
        <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm">
          Preparing map...
        </div>
      </div>
    );
  }

  const HeaderActions = deckMapDashboardPanelRenderer.headerActions;
  const MapPanel = deckMapDashboardPanelRenderer.component;
  const rendererProps = {
    dashboardId: mapId,
    dashboard,
    panel,
    selectionName: getMosaicDashboardSelectionName(mapId),
  };
  const mapConfig = panel.config as {datasets?: Record<string, unknown>};
  const hasDatasets = Object.keys(mapConfig.datasets ?? {}).length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MapIcon className="h-4 w-4 shrink-0" />
          <BlockCaptionEditor
            value={caption ?? panel.title ?? ''}
            placeholder={dashboard.selectedTable || title || 'Map caption'}
            isReadOnly={readOnly}
            onChange={(value: string) => onCaptionChange?.(value || undefined)}
          />
        </div>
        <div className="flex items-center gap-0.5">
          {headerActions ??
            (HeaderActions ? <HeaderActions {...rendererProps} /> : null)}
          <Button
            type="button"
            variant={isSettingsShown ? 'secondary' : 'ghost'}
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={
              isSettingsShown ? 'Close map settings' : 'Open map settings'
            }
            aria-pressed={isSettingsShown}
            onClick={handleSettingsClick}
          >
            <SlidersVerticalIcon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {hasDatasets ? (
          <MapPanel {...rendererProps} />
        ) : (
          <DataTableSelectorEmptyState
            onChange={handleTableChange}
            tables={tablesWithColumns}
            value={selectedTable}
          />
        )}
      </div>
    </div>
  );
}
