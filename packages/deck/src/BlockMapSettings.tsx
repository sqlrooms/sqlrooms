import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import {
  blockDocumentContentToBlocks,
  type BlockDocumentStatefulBlockBlock,
  type BlockSettingsComponentProps,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {useCallback, useMemo} from 'react';
import {useStoreWithDeckMaps} from './DeckMapsSlice';
import {DeckMapSettingsPanel} from './MapSettings';
import {regenerateMapConfigForTable} from './mapConfigUtils';

export function DeckMapBlockSettings({
  blockId,
  dashboardId,
  blockInstanceId,
  onClose,
  readOnly,
}: BlockSettingsComponentProps) {
  const mapId = blockInstanceId ?? blockId;
  const map = useStoreWithDeckMaps(
    (state) => state.deckMaps.config.mapsById[mapId],
  );
  const tables = useStoreWithDeckMaps((state) => state.db.tables);
  const updateMap = useStoreWithDeckMaps((state) => state.deckMaps.updateMap);
  const setSelectedTable = useStoreWithDeckMaps(
    (state) => state.deckMaps.setSelectedTable,
  );
  const artifact = useStoreWithBlockDocuments((state) =>
    dashboardId
      ? state.blockDocuments.config.artifacts[dashboardId]
      : undefined,
  );
  const updateBlock = useStoreWithBlockDocuments(
    (state) => state.blockDocuments.updateBlock,
  );
  const block = useMemo(
    () =>
      artifact
        ? blockDocumentContentToBlocks(artifact.content).find(
            (candidate): candidate is BlockDocumentStatefulBlockBlock =>
              candidate.id === blockId &&
              candidate.type === 'statefulBlock' &&
              candidate.blockType === 'map',
          )
        : undefined,
    [artifact, blockId],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (readOnly) return;
      updateMap(mapId, {title});
      if (dashboardId && block) {
        updateBlock(dashboardId, blockId, {
          ...block,
          caption: title || undefined,
        });
      }
    },
    [block, blockId, dashboardId, mapId, readOnly, updateBlock, updateMap],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (readOnly || !map) return;
      setSelectedTable(mapId, getTableIdentity(table.table));
      updateMap(mapId, {
        config: regenerateMapConfigForTable(
          {config: map.config},
          table,
        ) as typeof map.config,
      });
    },
    [map, mapId, readOnly, setSelectedTable, updateMap],
  );

  if (!map)
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Map settings not available
      </div>
    );
  return (
    <DeckMapSettingsPanel
      title={block?.caption ?? map.title}
      selectedTable={map.selectedTable}
      config={map.config}
      tables={tables.filter((table) => table.columns.length > 0)}
      onClose={onClose}
      onTitleChange={handleTitleChange}
      onTableChange={handleTableChange}
      onConfigChange={(config) => updateMap(mapId, {config})}
      readOnly={readOnly}
    />
  );
}
