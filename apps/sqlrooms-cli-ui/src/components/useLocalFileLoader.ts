import {
  BlockDocumentStatefulBlockBlock,
  blockDocumentNodeToBlock,
  createDefaultBlockDocumentBlockId,
} from '@sqlrooms/documents';
import {toast} from '@sqlrooms/ui';
import {convertToUniqueColumnOrTableName} from '@sqlrooms/utils';
import {useCallback} from 'react';
import {useCliRoomStoreApi, useRoomStore} from '../roomStoreHooks';
import type {RoomState} from '../store-types';

export const LOCAL_DATA_ACCEPTED_FORMATS = {
  'text/csv': ['.csv'],
  'text/tsv': ['.tsv'],
  'application/vnd.apache.parquet': ['.parquet'],
  'application/json': ['.json'],
  'application/geo+json': ['.geojson'],
};

function getCurrentOrFirstWorksheetArtifactId(
  state: RoomState,
): string | undefined {
  const currentArtifactId = state.artifacts.config.currentArtifactId;
  const currentArtifact = currentArtifactId
    ? state.artifacts.config.artifactsById[currentArtifactId]
    : undefined;

  if (currentArtifact?.type === 'worksheet') {
    return currentArtifactId;
  }

  return state.artifacts.config.artifactOrder.find(
    (artifactId) =>
      state.artifacts.config.artifactsById[artifactId]?.type === 'worksheet',
  );
}

function ensureImportWorksheetForTable(
  getState: () => RoomState,
  tableName: string,
) {
  const state = getState();
  const worksheetArtifactId =
    getCurrentOrFirstWorksheetArtifactId(state) ??
    state.artifacts.createArtifact({
      type: 'worksheet',
      title: 'Worksheet',
    });

  state.artifacts.setCurrentArtifact(worksheetArtifactId);
  state.blockDocuments.ensureBlockDocument(worksheetArtifactId);

  const nextState = getState();
  const existingBlocks =
    nextState.blockDocuments.config.artifacts[worksheetArtifactId]?.content
      .content ?? [];
  const hasDataTableExplorer = existingBlocks.some((node) => {
    const block = blockDocumentNodeToBlock(node);
    return (
      block?.type === 'statefulBlock' &&
      block.blockType === 'data-table' &&
      block.tableName === tableName
    );
  });

  if (hasDataTableExplorer) {
    return;
  }

  const blockId = createDefaultBlockDocumentBlockId();
  const block: BlockDocumentStatefulBlockBlock = {
    type: 'statefulBlock',
    id: blockId,
    blockInstanceId: blockId,
    blockType: 'data-table',
    tableName,
    caption: `${tableName} profile`,
    intent: `Initial profile for imported table ${tableName}`,
  };

  nextState.blockDocuments.appendBlocks(worksheetArtifactId, [block]);
}

export function useLocalFileLoader() {
  const roomStore = useCliRoomStoreApi();
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );

  return useCallback(
    async (files: File[]) => {
      const createdTableNames: string[] = [];
      const createdTables: Array<{fileName: string; tableName: string}> = [];
      for (const file of files) {
        try {
          const tableName = convertToUniqueColumnOrTableName(
            file.name,
            createdTableNames,
          );
          await connector.loadFile(file, tableName);
          createdTableNames.push(tableName);
          createdTables.push({fileName: file.name, tableName});
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          toast.error('Error', {
            description: `Error loading file ${file.name}: ${errorMessage}`,
          });
        }
      }
      try {
        await refreshTableSchemas();
      } catch (error) {
        console.error('Failed to refresh table schemas', error);
        toast.error('Failed to refresh table schemas', {
          description:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        });
        return;
      }
      for (const {tableName} of createdTables) {
        ensureImportWorksheetForTable(roomStore.getState, tableName);
      }
      for (const {fileName, tableName} of createdTables) {
        toast.success('Table created', {
          description: `File ${fileName} loaded as ${tableName}`,
        });
      }
    },
    [connector, refreshTableSchemas, roomStore],
  );
}
