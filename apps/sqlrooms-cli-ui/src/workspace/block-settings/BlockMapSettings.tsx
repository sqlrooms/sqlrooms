import type {
  BlockDocumentStatefulBlockBlock,
  BlockSettingsComponentProps,
} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useMemo, useCallback} from 'react';
import {MapSettingsPanel} from '@sqlrooms/deck';
import {type DataTable} from '@sqlrooms/db';

export const BlockMapSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  // Get the map block's instance ID (which is actually a dashboard ID internally)
  const mapId = useRoomStore((state) => {
    if (!dashboardId) return undefined;
    const blocks = state.blockDocuments.getBlocks(dashboardId);
    const block = blocks.find(
      (block): block is BlockDocumentStatefulBlockBlock =>
        block.id === blockId &&
        block.type === 'statefulBlock' &&
        block.blockType === 'map',
    );
    return block?.blockInstanceId;
  });

  // Map blocks internally use a dashboard with one panel
  const dashboard = useRoomStore((state) =>
    mapId ? state.mosaicDashboard.getDashboard(mapId) : undefined,
  );

  const panel = useMemo(
    () => dashboard?.panels.find((p) => p.type === 'deck-json-map'),
    [dashboard?.panels],
  );

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

  if (!mapId || !dashboard || !panel) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Map settings not available
        </p>
      </div>
    );
  }

  return (
    <>
      <MapSettingsPanel
        dashboardId={mapId}
        panel={panel}
        onTableChange={handleTableChange}
      />
    </>
  );
};
