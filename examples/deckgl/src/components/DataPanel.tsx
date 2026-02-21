import {RoomPanel} from '@sqlrooms/room-shell';
import {TableStructurePanel} from '@sqlrooms/sql-editor';
import {FileDropzone} from '@sqlrooms/dropzone';
import {useRoomStore} from '../store';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {useToast} from '@sqlrooms/ui';

export const DataPanel = () => {
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );
  const {toast} = useToast();

  return (
    <RoomPanel type="data">
      <FileDropzone
        className="h-50 p-5"
        acceptedFormats={{
          'text/csv': ['.csv'],
          'text/tsv': ['.tsv'],
          'text/parquet': ['.parquet'],
          'text/json': ['.json'],
        }}
        onDrop={async (files: File[]) => {
          for (const file of files) {
            try {
              const tableName = convertToValidColumnOrTableName(file.name);
              await connector.loadFile(file, tableName);
              toast({
                variant: 'default',
                title: 'Table created',
                description: `File ${file.name} loaded as ${tableName}`,
              });
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Error',
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
      <TableStructurePanel />
    </RoomPanel>
  );
};
