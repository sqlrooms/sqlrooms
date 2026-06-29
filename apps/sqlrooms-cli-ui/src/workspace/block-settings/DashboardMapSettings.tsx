import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useCallback, useMemo} from 'react';
import {
  createDeckMapDashboardPanelConfig,
  createDeckMapDashboardPanelConfigForTable,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
  MapSettingsPanel,
} from '@sqlrooms/deck';
import {type DataTable} from '@sqlrooms/db';
import {ConfirmDatasetChangeDialog} from './ConfirmDatasetChangeDialog';
import {useConfirmDatasetChange} from './useConfirmDatasetChange';

function createEmptyMapPanelConfig(title = 'Map') {
  return createDeckMapDashboardPanelConfig({
    title,
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [],
    },
    datasets: {},
  });
}

export const DashboardMapSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  const dashboard = useRoomStore((state) =>
    dashboardId ? state.mosaicDashboard.getDashboard(dashboardId) : undefined,
  );

  const updatePanel = useRoomStore(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const setSelectedTable = useRoomStore(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const panel = useMemo(
    () => dashboard?.panels.find((p) => p.id === blockId),
    [dashboard?.panels, blockId],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (dashboardId && panel) {
        setSelectedTable(dashboardId, table.table.toString());
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
          : createEmptyMapPanelConfig(panel.title);
        updatePanel(dashboardId, blockId, {
          title: nextPanel.title,
          type: nextPanel.type,
          config: nextPanel.config,
        });
      }
    },
    [blockId, dashboardId, panel, setSelectedTable, updatePanel],
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (dashboardId) {
        updatePanel(dashboardId, blockId, {title: newTitle || undefined});
      }
    },
    [dashboardId, blockId, updatePanel],
  );

  const {handleTableChangeRequest, handleConfirm, handleCancel, isDialogOpen} =
    useConfirmDatasetChange(handleTableChange);

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Dashboard not found</p>
      </div>
    );
  }

  if (!panel || panel.type !== 'deck-json-map') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Map panel not found</p>
      </div>
    );
  }

  return (
    <>
      <MapSettingsPanel
        dashboardId={dashboard.id}
        panel={panel}
        onTableChange={handleTableChangeRequest}
        onTitleChange={handleTitleChange}
      />

      <ConfirmDatasetChangeDialog
        open={isDialogOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
