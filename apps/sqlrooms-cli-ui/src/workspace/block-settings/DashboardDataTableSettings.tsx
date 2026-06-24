import {useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useCallback} from 'react';
import {DataTableSettingsPanel} from '@sqlrooms/mosaic';
import {ConfirmDatasetChangeDialog} from './ConfirmDatasetChangeDialog';
import {useConfirmDatasetChange} from './useConfirmDatasetChange';

export const DashboardDataTableSettings: FC<BlockSettingsComponentProps> = ({
  dashboardId,
}) => {
  const dashboard = useRoomStore((state) =>
    dashboardId ? state.mosaicDashboard.getDashboard(dashboardId) : undefined,
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

  const {handleTableChangeRequest, handleConfirm, handleCancel, isDialogOpen} =
    useConfirmDatasetChange(handleTableChange);

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Dashboard not found</p>
      </div>
    );
  }

  const tableName = dashboard.selectedTable;
  const dataTable = useDataTable(tableName);

  return (
    <>
      <DataTableSettingsPanel
        value={dataTable}
        onChange={handleTableChangeRequest}
      />
      <ConfirmDatasetChangeDialog
        open={isDialogOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
