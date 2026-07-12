import {getTableIdentity} from '@sqlrooms/duckdb';
import {
  blockDocumentContentToBlocks,
  type BlockDocumentStatefulBlockBlock,
  type BlockSettingsComponentProps,
  useStoreWithBlockDocuments,
} from '@sqlrooms/documents';
import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import {useMemo} from 'react';
import {useStoreWithDeckMaps} from './DeckMapsSlice';
import {
  createDeckMapConfigForTable,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
} from './mapConfigUtils';

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

  if (!map)
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Map settings not available
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>Map settings</span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onClose}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <label className="space-y-1 text-xs">
        <span>Title</span>
        <input
          className="border-border bg-background w-full rounded border px-2 py-1.5 text-sm"
          value={block?.caption ?? map.title}
          readOnly={readOnly}
          onChange={(event) => {
            const title = event.target.value;
            updateMap(mapId, {title});
            if (dashboardId && block)
              updateBlock(dashboardId, blockId, {
                ...block,
                caption: title || undefined,
              });
          }}
        />
      </label>
      <label className="space-y-1 text-xs">
        <span>Table</span>
        <select
          className="border-border bg-background w-full rounded border px-2 py-1.5 text-sm"
          value={map.selectedTable ?? ''}
          disabled={readOnly}
          onChange={(event) => {
            const table = tables.find(
              (candidate) =>
                getTableIdentity(candidate.table) === event.target.value,
            );
            if (!table) return;
            setSelectedTable(mapId, getTableIdentity(table.table));
            if (
              findLongitudeLatitudeColumns(table) ||
              findGeometryColumn(table)
            ) {
              updateMap(mapId, {
                config: createDeckMapConfigForTable({
                  tableName: table.tableName,
                  columns: table.columns,
                  tableReference: table.table,
                }),
              });
            }
          }}
        >
          <option value="">Select a table</option>
          {tables.map((table) => (
            <option
              key={getTableIdentity(table.table)}
              value={getTableIdentity(table.table)}
            >
              {table.tableName}
            </option>
          ))}
        </select>
      </label>
      {map.config.configMode === 'custom' && (
        <p className="text-muted-foreground text-xs">
          This AI-authored map uses custom configuration. Edit it through the
          map tool.
        </p>
      )}
    </div>
  );
}
