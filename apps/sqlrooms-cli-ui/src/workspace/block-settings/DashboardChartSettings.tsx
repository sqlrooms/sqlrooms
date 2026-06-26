import {useDataTable, type DataTable} from '@sqlrooms/db';
import {ChartConfig, ChartSettingsPanel} from '@sqlrooms/mosaic';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useMemo, useCallback} from 'react';
import {ConfirmDatasetChangeDialog} from './ConfirmDatasetChangeDialog';
import {useConfirmDatasetChange} from './useConfirmDatasetChange';

export const DashboardChartSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  // For dashboard panels
  const dashboard = useRoomStore((state) =>
    dashboardId ? state.mosaicDashboard.getDashboard(dashboardId) : undefined,
  );

  const updatePanel = useRoomStore(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const setSelectedTable = useRoomStore(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (dashboardId) {
        setSelectedTable(dashboardId, table.table.table);
      }
    },
    [dashboardId, setSelectedTable],
  );

  const handleConfigChange = useCallback(
    (newConfig: ChartConfig) => {
      if (dashboardId) {
        updatePanel(dashboardId, blockId, {config: newConfig});
      }
    },
    [dashboardId, blockId, updatePanel],
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

  // Call hooks before any conditional returns
  const panel = useMemo(
    () => dashboard?.panels?.find((p) => p.id === blockId),
    [dashboard, blockId],
  );

  const tableName = dashboard?.selectedTable;
  const config = (panel?.config || {}) as ChartConfig;
  const dataTable = useDataTable(tableName);

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Dashboard not found</p>
      </div>
    );
  }

  if (!panel || panel.type !== 'vgplot') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Chart panel not found</p>
      </div>
    );
  }

  return (
    <>
      <ChartSettingsPanel
        dataTable={dataTable}
        config={config}
        onConfigChange={handleConfigChange}
        onTableChange={handleTableChangeRequest}
        title={panel.title || ''}
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
