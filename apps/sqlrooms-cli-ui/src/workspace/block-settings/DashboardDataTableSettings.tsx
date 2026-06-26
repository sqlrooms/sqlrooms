import {useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useCallback, useMemo} from 'react';
import {DataTableSettingsPanel} from '@sqlrooms/mosaic';
import {ConfirmDatasetChangeDialog} from './ConfirmDatasetChangeDialog';
import {useConfirmDatasetChange} from './useConfirmDatasetChange';

export const DashboardDataTableSettings: FC<BlockSettingsComponentProps> = ({
  dashboardId,
  blockId,
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

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (dashboardId) {
        setSelectedTable(dashboardId, table.table.table);
      }
    },
    [dashboardId, setSelectedTable],
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
  const dataTable = useDataTable(tableName);

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Dashboard not found</p>
      </div>
    );
  }

  if (!panel || panel.type !== 'data-table-explorer') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Data table panel not found
        </p>
      </div>
    );
  }

  return (
    <>
      <DataTableSettingsPanel
        value={dataTable}
        onChange={handleTableChangeRequest}
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
