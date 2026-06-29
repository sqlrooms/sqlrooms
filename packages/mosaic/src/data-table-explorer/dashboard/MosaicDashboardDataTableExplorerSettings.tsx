import {useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {type FC, useCallback, useMemo} from 'react';
import {
  ConfirmDatasetChangeDialog,
  useConfirmDatasetChange,
} from '../../dashboard/ConfirmDatasetChangeDialog';
import {useStoreWithMosaicDashboard} from '../../dashboard/MosaicDashboardSlice';
import {DataTableSettingsPanel} from '../DataTableSettingsPanel';

/**
 * Settings adapter for a Mosaic data-table explorer dashboard panel.
 */
export const MosaicDashboardDataTableExplorerSettings: FC<
  BlockSettingsComponentProps
> = ({blockId, dashboardId}) => {
  const dashboard = useStoreWithMosaicDashboard((state) =>
    dashboardId ? state.mosaicDashboard.getDashboard(dashboardId) : undefined,
  );
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const panel = useMemo(
    () => dashboard?.panels.find((candidate) => candidate.id === blockId),
    [dashboard?.panels, blockId],
  );
  const dataTable = useDataTable(dashboard?.selectedTable);

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (dashboardId) {
        setSelectedTable(dashboardId, table.table.toString());
      }
    },
    [dashboardId, setSelectedTable],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (dashboardId) {
        updatePanel(dashboardId, blockId, {title: title || undefined});
      }
    },
    [dashboardId, blockId, updatePanel],
  );

  const {
    handleChangeRequest,
    handleConfirm,
    handleCancel,
    isDialogOpen,
  } = useConfirmDatasetChange(handleTableChange);

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
        onChange={handleChangeRequest}
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
