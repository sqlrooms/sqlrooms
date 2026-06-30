import {useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {type FC, useCallback} from 'react';
import {DataTableSelector} from '../components/DataTableSelector';
import {Field} from '../components/Field';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {
  ConfirmDatasetChangeDialog,
  useConfirmDatasetChange,
} from './ConfirmDatasetChangeDialog';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';

/**
 * Settings adapter for a Mosaic dashboard surface.
 */
export const MosaicDashboardSettings: FC<BlockSettingsComponentProps> = ({
  blockInstanceId,
  blockId,
  readOnly,
}) => {
  const dashboardId = blockInstanceId ?? blockId;
  const dashboard = useStoreWithMosaicDashboard((state) =>
    state.mosaicDashboard.getDashboard(dashboardId),
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const dataTable = useDataTable(dashboard?.selectedTable);
  const tables = useTablesWithColumns();

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (readOnly) return;

      setSelectedTable(dashboardId, table.table.toString());
    },
    [dashboardId, readOnly, setSelectedTable],
  );

  const {handleChangeRequest, handleConfirm, handleCancel, isDialogOpen} =
    useConfirmDatasetChange(handleTableChange);

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
            onChange={handleChangeRequest}
            tables={tables}
            value={dataTable}
            className="w-full"
            disabled={readOnly}
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
