import {RoomPanel} from '@sqlrooms/room-shell';
import {TableStructurePanel} from '@sqlrooms/sql-editor';
import {FileDropzone} from '@sqlrooms/dropzone';
import {useRoomStore, RoomPanelTypes} from '../store';
import {useToast} from '@sqlrooms/ui';

export const DataPanel = () => {
  const {toast} = useToast();
  const addFile = useRoomStore((state) => state.addFile);
  return (
    <RoomPanel type={RoomPanelTypes.enum['data']}>
      <FileDropzone
        className="h-[200px] p-5"
        acceptedFormats={{
          'text/csv': ['.csv'],
          'text/tsv': ['.tsv'],
          'text/parquet': ['.parquet'],
          'text/json': ['.json'],
          'text/geojson': ['.geojson'],
        }}
        onDrop={async (files) => {
          for (const file of files) {
            try {
              const addedTable = await addFile(file);
              toast({
                variant: 'default',
                title: 'Table created',
                description: `File ${file.name} loaded as ${addedTable}`,
              });
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Error',
                description: `Error loading file ${file.name}: ${error}`,
              });
            }
          }
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
