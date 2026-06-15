import {toast} from '@sqlrooms/ui';
import {convertToUniqueColumnOrTableName} from '@sqlrooms/utils';
import {useCallback} from 'react';
import {useRoomStore} from '../store';

export const LOCAL_DATA_ACCEPTED_FORMATS = {
  'text/csv': ['.csv'],
  'text/tsv': ['.tsv'],
  'application/vnd.apache.parquet': ['.parquet'],
  'application/json': ['.json'],
};

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
            error instanceof Error ? error.message : 'An unknown error occurred',
        });
        return;
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
