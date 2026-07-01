import type {DataTable} from '@sqlrooms/duckdb';
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
        setSelectedTable(dashboardId, table.table.toString());
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

  const isCustomMode =
    (panel.config as Record<string, unknown>)?.configMode === 'custom';

  if (isCustomMode) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
          <span>Map settings</span>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-sm">
          <p>
            This map uses a custom AI-generated configuration.
            <br />
            Use the JSON editor to make changes.
          </p>
        </div>
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
