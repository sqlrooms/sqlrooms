import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useRoomStore} from '../../store';
import {FC, useMemo, useCallback} from 'react';
import {
  createDeckMapDashboardPanelConfig,
  createDeckMapDashboardPanelConfigForTable,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
  MapSettingsPanel,
} from '@sqlrooms/deck';
import {type DataTable} from '@sqlrooms/db';
import {useMapBlock} from './useMapBlock';

function createEmptyMapPanelConfig(title = 'Map') {
  return createDeckMapDashboardPanelConfig({
    title,
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [],
    },
    datasets: {},
  });
}

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

  const updatePanel = useRoomStore(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (mapId && panel) {
        setSelectedTable(mapId, table.table.toString());
        const hasGeospatialColumns =
          Boolean(findLongitudeLatitudeColumns(table)) ||
          Boolean(findGeometryColumn(table));
        const nextPanel = hasGeospatialColumns
          ? createDeckMapDashboardPanelConfigForTable({
              title: `${table.tableName} map`,
              tableName: table.tableName,
              columns: table.columns,
              tableReference: table.table,
            })
          : createEmptyMapPanelConfig(mapBlock?.caption ?? panel.title);
        updatePanel(mapId, panel.id, {
          title: nextPanel.title,
          type: nextPanel.type,
          config: nextPanel.config,
        });
      }
    },
    [mapBlock?.caption, mapId, panel, setSelectedTable, updatePanel],
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
