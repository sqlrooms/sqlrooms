import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import {
  blockDocumentContentToBlocks,
  type BlockDocumentStatefulBlockBlock,
  type BlockSettingsComponentProps,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import {useCallback, useMemo} from 'react';
import {useStoreWithDeckMaps} from './DeckMapsSlice';
import {DeckMapSettingsPanel} from './MapSettings';
import {regenerateMapConfigForTable} from './mapConfigUtils';
import {getDeckMapResourceConfigIssues} from './mapResourceAuthoring';

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
  const configIssues = useMemo(
    () =>
      map ? getDeckMapResourceConfigIssues(map.config, {allowEmpty: true}) : [],
    [map],
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
      const config = regenerateMapConfigForTable({config: map.config}, table);
      if (config === map.config) return;
      updateMap(mapId, {
        selectedTable: getTableIdentity(table.table),
        config: config as typeof map.config,
      });
    },
    [map, mapId, readOnly, updateMap],
  );

  if (!map)
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Map settings not available
      </div>
    );

  if (configIssues.length > 0 || map.config.configMode === 'custom') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
          <span>Map settings</span>
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClose}
              aria-label="Close"
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-sm">
          {configIssues.length > 0
            ? `Invalid map configuration: ${configIssues[0]!.path}: ${configIssues[0]!.message}`
            : 'This custom map configuration cannot be safely edited with the basic settings controls.'}
        </div>
      </div>
    );
  }

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
