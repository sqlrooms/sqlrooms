import {
  BlockDocumentStatefulBlockBlock,
  createDefaultBlockDocumentBlockId,
} from '@sqlrooms/documents';
import {toast} from '@sqlrooms/ui';
import {convertToUniqueColumnOrTableName} from '@sqlrooms/utils';
import {useCallback} from 'react';
import {useRoomStore} from '../store';
import type {RoomState} from '../store-types';

export const LOCAL_DATA_ACCEPTED_FORMATS = {
  'text/csv': ['.csv'],
  'text/tsv': ['.tsv'],
  'application/vnd.apache.parquet': ['.parquet'],
  'application/json': ['.json'],
  'application/geo+json': ['.geojson'],
};

function getCurrentOrFirstWorksheetId(state: RoomState): string | undefined {
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

function ensureImportWorksheetForTable(tableName: string) {
  const state = useRoomStore.getState();
  const worksheetId =
    getCurrentOrFirstWorksheetId(state) ??
    state.artifacts.createArtifact({
      type: 'worksheet',
      title: 'Worksheet',
    });

  state.artifacts.setCurrentArtifact(worksheetId);
  state.blockDocuments.ensureBlockDocument(worksheetId);

  const nextState = useRoomStore.getState();
  const existingBlocks =
    nextState.blockDocuments.config.artifacts[worksheetId]?.content.content ??
    [];
  const hasDataTableExplorer = existingBlocks.some(
    (block) =>
      block.type === 'statefulBlock' &&
      block.blockType === 'data-table' &&
      block.title === tableName,
  );

  if (hasDataTableExplorer) {
    return;
  }

  const block: BlockDocumentStatefulBlockBlock = {
    type: 'statefulBlock',
    id: createDefaultBlockDocumentBlockId(),
    blockInstanceId: createDefaultBlockDocumentBlockId(),
    blockType: 'data-table',
    title: tableName,
    caption: `${tableName} profile`,
    intent: `Initial profile for imported table ${tableName}`,
  };

  nextState.blockDocuments.appendBlocks(worksheetId, [block]);
}

export function useLocalFileLoader() {
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
        ensureImportWorksheetForTable(tableName);
      }
      for (const {fileName, tableName} of createdTables) {
        toast.success('Table created', {
          description: `File ${fileName} loaded as ${tableName}`,
        });
      }
    },
    [connector, refreshTableSchemas],
  );
}
