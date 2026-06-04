import {toast} from '@sqlrooms/ui';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {useCallback} from 'react';
import {useRoomStore} from '../store';

export const LOCAL_DATA_ACCEPTED_FORMATS = {
  'text/csv': ['.csv'],
  'text/tsv': ['.tsv'],
  'text/parquet': ['.parquet'],
  'text/json': ['.json'],
};

export function useLocalFileLoader() {
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );

  return useCallback(
    async (files: File[]) => {
      const createdTableNames: string[] = [];
      for (const file of files) {
        try {
          const tableName = convertToValidColumnOrTableName(file.name);
          await connector.loadFile(file, tableName);
          createdTableNames.push(tableName);
          toast.success('Table created', {
            description: `File ${file.name} loaded as ${tableName}`,
          });
        } catch (error) {
          toast.error('Error', {
            description: `Error loading file ${file.name}: ${error}`,
          });
        }
      }
      await refreshTableSchemas();
    },
    [connector, refreshTableSchemas],
  );
}
