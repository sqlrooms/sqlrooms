import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {
  createDeckMapDashboardPanelConfigForTable,
  deckMapDashboardPanelRenderer,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
} from '@sqlrooms/deck';
import {getMosaicDashboardSelectionName} from '@sqlrooms/mosaic';
import {MapIcon} from 'lucide-react';
import {useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';

export const WorksheetMapBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  const dashboard = useRoomStore(
    (state) => state.mosaicDashboard.config.dashboardsById[blockInstanceId],
  );
  const tables = useRoomStore((state) => state.db.tables);
  const ensureDashboard = useRoomStore(
    (state) => state.mosaicDashboard.ensureDashboard,
  );
  const setSelectedTable = useRoomStore(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const addPanel = useRoomStore((state) => state.mosaicDashboard.addPanel);

  useEffect(() => {
    if (blockType !== 'map' || !blockInstanceId) {
      return;
    }

    ensureDashboard(blockInstanceId, title ?? 'Embedded Map', 'grid');
  }, [blockInstanceId, blockType, ensureDashboard, title]);

  useEffect(() => {
    if (blockType !== 'map' || !blockInstanceId || !dashboard) {
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
    if (!table) {
      return;
    }

    setSelectedTable(blockInstanceId, table.tableName);
    addPanel(
      blockInstanceId,
      createDeckMapDashboardPanelConfigForTable({
        title: `${table.tableName} map`,
        tableName: table.tableName,
        columns: table.columns,
        tableReference: table.table,
      }),
    );
  }, [
    addPanel,
    blockInstanceId,
    blockType,
    dashboard,
    setSelectedTable,
    tables,
  ]);

  const panel = useMemo(
    () =>
      dashboard?.panels.find(
        (candidate) => candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
      ),
    [dashboard?.panels],
  );

  if (!blockInstanceId || blockType !== 'map') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  if (!dashboard || !panel) {
    return (
      <div className="bg-muted/10 flex h-full min-h-[320px] flex-col">
        <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm font-medium">
          <MapIcon className="h-4 w-4" />
          <span>{title || 'Embedded Map'}</span>
        </div>
        <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm">
          No map-ready table found. Add a table with longitude/latitude or
          geometry columns, or ask the assistant to configure this map.
        </div>
      </div>
    );
  }

  const HeaderActions = deckMapDashboardPanelRenderer.headerActions;
  const MapPanel = deckMapDashboardPanelRenderer.component;
  const rendererProps = {
    dashboardId: blockInstanceId,
    dashboard,
    panel,
    selectionName: getMosaicDashboardSelectionName(blockInstanceId),
  };

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
        <MapPanel {...rendererProps} />
      </div>
    </div>
  );
};
