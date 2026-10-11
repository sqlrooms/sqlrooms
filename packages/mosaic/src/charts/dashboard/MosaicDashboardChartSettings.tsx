import {getTableIdentity, useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {type FC, useCallback, useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../../dashboard/MosaicDashboardSlice';
import type {ChartPanelConfig} from '../../dashboard/dashboard-types';
import {
  ConfirmDatasetChangeDialog,
  useConfirmDatasetChange,
} from '../../dashboard/ConfirmDatasetChangeDialog';
import {type ChartConfig} from '../chart-types/chart-config';
import {ChartSettingsPanel} from '../ChartSettingsPanel';

/**
 * Settings adapter for a Mosaic chart panel inside a dashboard.
 */
export const MosaicDashboardChartSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
  readOnly,
  onClose,
}) => {
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
      if (readOnly) return;

      if (dashboardId) {
        setSelectedTable(dashboardId, getTableIdentity(table.table));
      }
    },
    [dashboardId, readOnly, setSelectedTable],
  );

  const handleConfigChange = useCallback(
    (config: ChartConfig) => {
      if (readOnly) return;

      if (dashboardId) {
        updatePanel(dashboardId, blockId, {config});
      }
    },
    [dashboardId, blockId, readOnly, updatePanel],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (readOnly) return;

      if (dashboardId) {
        updatePanel(dashboardId, blockId, {title: title || undefined});
      }
    },
    [dashboardId, blockId, readOnly, updatePanel],
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

  if (!panel || panel.type !== 'vgplot') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Chart panel not found</p>
      </div>
    );
  }

  const chartPanel = panel as ChartPanelConfig;

  return (
    <>
      <ChartSettingsPanel
        dataTable={dataTable}
        config={(chartPanel.config || {}) as ChartConfig}
        onConfigChange={handleConfigChange}
        onTableChange={handleChangeRequest}
        title={chartPanel.title || ''}
        onTitleChange={handleTitleChange}
        onClose={onClose}
        readOnly={readOnly}
      />
      <ConfirmDatasetChangeDialog
        open={isDialogOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
