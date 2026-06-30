import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {
  ConfirmDatasetChangeDialog,
  useConfirmDatasetChange,
  useStoreWithMosaicDashboard,
} from '@sqlrooms/mosaic';
import {type FC, useCallback} from 'react';
import {MapSettingsPanel} from './MapSettings';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from './dashboardConfig';

/**
 * Settings adapter for a Deck map panel inside a Mosaic dashboard.
 */
export const DeckMapDashboardSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
  onClose,
  readOnly,
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

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (readOnly) return;

      if (dashboardId) {
        setSelectedTable(dashboardId, getTableIdentity(table.table));
      }
    },
    [dashboardId, readOnly, setSelectedTable],
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

  const panel = dashboard.panels.find((candidate) => candidate.id === blockId);

  if (!panel || panel.type !== DECK_MAP_DASHBOARD_PANEL_TYPE) {
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
        onClose={onClose}
        onTableChange={handleChangeRequest}
        onTitleChange={handleTitleChange}
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
