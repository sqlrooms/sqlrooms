import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useMemo, useCallback} from 'react';
import {MapSettingsPanel} from '@sqlrooms/deck';
import {type DataTable} from '@sqlrooms/db';
import {useMapBlock} from './useMapBlock';

export const BlockMapSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  // Get the map block from worksheet
  const mapBlock = useMapBlock(dashboardId, blockId);
  const mapId = mapBlock?.blockInstanceId;

  // Map blocks internally use a dashboard with one panel
  const dashboard = useRoomStore((state) =>
    mapId ? state.mosaicDashboard.getDashboard(mapId) : undefined,
  );

  const panel = useMemo(
    () => dashboard?.panels.find((p) => p.type === 'deck-json-map'),
    [dashboard?.panels],
  );

  const updateBlock = useRoomStore((state) => state.blockDocuments.updateBlock);

  const setSelectedTable = useRoomStore(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (mapId) {
        setSelectedTable(mapId, table.table.table);
      }
    },
    [mapId, setSelectedTable],
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (dashboardId && mapBlock) {
        // Update the stateful block's caption in the worksheet
        updateBlock(dashboardId, blockId, {
          ...mapBlock,
          caption: newTitle || undefined,
        });
      }
    },
    [dashboardId, blockId, mapBlock, updateBlock],
  );

  if (!mapId || !dashboard || !panel || !mapBlock) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Map settings not available
        </p>
      </div>
    );
  }

  // Create a modified panel with caption from the block for display
  const panelWithCaption = {
    ...panel,
    title: mapBlock.caption ?? panel.title,
  };

  return (
    <>
      <MapSettingsPanel
        dashboardId={mapId}
        panel={panelWithCaption}
        onTableChange={handleTableChange}
        onTitleChange={handleTitleChange}
      />
    </>
  );
};
