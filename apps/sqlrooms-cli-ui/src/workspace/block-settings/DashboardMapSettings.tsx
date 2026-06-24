import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useCallback} from 'react';
import {MapSettingsPanel} from '@sqlrooms/deck';
import {type DataTable} from '@sqlrooms/db';
import {ConfirmDatasetChangeDialog} from './ConfirmDatasetChangeDialog';
import {useConfirmDatasetChange} from './useConfirmDatasetChange';

export const DashboardMapSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
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

  const panel = dashboard.panels.find((p) => p.id === blockId);

  if (!panel || panel.type !== 'deck-json-map') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Map panel not found</p>
      </div>
    );
  }

  return (
    <>
      <MapSettingsPanel
        dashboardId={dashboardId!}
        panel={panel}
        onTableChange={handleTableChangeRequest}
      />

      <ConfirmDatasetChangeDialog
        open={isDialogOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
