import {
  DataTableSelectorEmptyState,
  getMosaicDashboardSelectionName,
  type MosaicDashboardStoreState,
  useTablesWithColumns,
  useStoreWithMosaicDashboard,
} from '@sqlrooms/mosaic';
import type {DataTable} from '@sqlrooms/duckdb';
import {MapIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo} from 'react';
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
    state.mosaicDashboard.setSelectedTable(mapId, table.tableName);
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
};

/**
 * Renders an embeddable Deck map block backed by SQLRooms map panel state.
 */
export function DeckMapBlockRenderer({
  mapId,
  title,
  caption,
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
      setSelectedTable(mapId, table.tableName);
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
        (table) => table.table.toString() === dashboard?.selectedTable,
      ),
    [dashboard?.selectedTable, tablesWithColumns],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (!mapId || !panel) {
        return;
      }

      setSelectedTable(mapId, table.table.toString());
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
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <MapIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{caption || title || panel.title}</span>
        </div>
        {HeaderActions ? <HeaderActions {...rendererProps} /> : null}
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
