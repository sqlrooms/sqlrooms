import {useDataTable, type DataTable} from '@sqlrooms/db';
import {DataTableSelector, useTablesWithColumns, Field} from '@sqlrooms/mosaic';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useCallback} from 'react';
import {ConfirmDatasetChangeDialog} from './ConfirmDatasetChangeDialog';
import {useConfirmDatasetChange} from './useConfirmDatasetChange';

export const BlockDashboardSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  blockInstanceId,
}) => {
  const dashboardId = blockInstanceId ?? blockId;
  const dashboard = useRoomStore((state) =>
    state.mosaicDashboard.getDashboard(dashboardId),
  );

  const setSelectedTable = useRoomStore(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      setSelectedTable(dashboardId, table.table.table);
    },
    [dashboardId, setSelectedTable],
  );

  const {handleTableChangeRequest, handleConfirm, handleCancel, isDialogOpen} =
    useConfirmDatasetChange(handleTableChange);

  // Call hooks before any conditional returns
  const tableName = dashboard?.selectedTable;
  const dataTable = useDataTable(tableName);
  const tables = useTablesWithColumns();

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Dashboard not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Dashboard Settings</h3>
        </div>

        <Field label="Dataset" required>
          <DataTableSelector
            onChange={handleTableChangeRequest}
            tables={tables}
            value={dataTable}
            className="w-full"
          />
        </Field>
      </div>

      <ConfirmDatasetChangeDialog
        open={isDialogOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
