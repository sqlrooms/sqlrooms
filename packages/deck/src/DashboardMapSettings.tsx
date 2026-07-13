import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {
  ConfirmDatasetChangeDialog,
  useConfirmDatasetChange,
  useStoreWithMosaicDashboard,
  useTablesWithColumns,
} from '@sqlrooms/mosaic';
import {type FC, useCallback} from 'react';
import {DeckMapSettingsPanel} from './MapSettings';
import {
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import type {DeckMapConfig} from './mapConfig';

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
  const tables = useTablesWithColumns();

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

  const handleConfigChange = useCallback(
    (config: DeckMapConfig) => {
      if (readOnly || !dashboardId) return;
      updatePanel(dashboardId, blockId, {
        config: config as unknown as Record<string, unknown>,
      });
    },
    [blockId, dashboardId, readOnly, updatePanel],
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
      <DeckMapSettingsPanel
        title={panel.title}
        selectedTable={dashboard.selectedTable}
        config={panel.config as DeckMapDashboardPanelConfig}
        tables={tables}
        onClose={onClose}
        onTableChange={handleChangeRequest}
        onTitleChange={handleTitleChange}
        onConfigChange={handleConfigChange}
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
