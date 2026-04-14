import {FileDropzone} from '@sqlrooms/dropzone';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {toast} from '@sqlrooms/ui';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {useRoomStore} from '../store';
import {DbConnectionsSection} from './DbConnectionsSection';

export const DataSourcesPanel = () => {
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );

  return (
    <div className="flex h-full flex-col">
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
          Files stay on your machine and are loaded into DuckDB locally.
        </div>
      </FileDropzone>

      <SchemaExplorer>
        <SchemaExplorer.Header>
          <SchemaExplorer.RefreshButton />
        </SchemaExplorer.Header>
        <SchemaExplorer.Tree className="h-full" />
      </SchemaExplorer>

      <DbConnectionsSection />
    </div>
  );
};
