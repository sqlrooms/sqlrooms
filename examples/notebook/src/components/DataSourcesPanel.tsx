import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {useRoomStore, RoomPanelTypes} from '../store';
import {toast} from '@sqlrooms/ui';
import {FileDropzone} from '@sqlrooms/dropzone';
import {RoomPanel} from '@sqlrooms/room-shell';
import {FC} from 'react';

export const DataSourcesPanel: FC = () => {
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );

  return (
    <RoomPanel type={RoomPanelTypes.enum['data']}>
      <FileDropzone
        className="h-50 p-5"
        acceptedFormats={{
          'text/csv': ['.csv'],
          'text/tsv': ['.tsv'],
          'text/parquet': ['.parquet'],
          'text/json': ['.json'],
        }}
        onDrop={async (files) => {
          for (const file of files) {
            try {
              const tableName = convertToValidColumnOrTableName(file.name);
              await connector.loadFile(file, tableName);
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
        }}
      >
        <div className="text-muted-foreground text-xs">
          Files you add will stay local to your browser.
        </div>
      </FileDropzone>
      <SchemaExplorer>
        <SchemaExplorer.Header>
          <SchemaExplorer.RefreshButton />
        </SchemaExplorer.Header>
        <SchemaExplorer.Tree className="h-full" />
      </SchemaExplorer>
    </RoomPanel>
  );
};
