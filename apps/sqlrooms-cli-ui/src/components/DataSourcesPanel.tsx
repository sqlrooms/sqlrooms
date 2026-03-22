import {DbSettings} from '@sqlrooms/db-settings';
import {FileDropzone} from '@sqlrooms/dropzone';
import {RoomPanel} from '@sqlrooms/room-shell';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@sqlrooms/ui';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {RoomPanelTypes} from '../layout';
import {useRoomStore} from '../store';

export const DataSourcesPanel = () => {
  const connector = useRoomStore((state) => state.db.connector);
  const refreshTableSchemas = useRoomStore(
    (state) => state.db.refreshTableSchemas,
  );

  return (
    <RoomPanel type={RoomPanelTypes.enum['data-sources']}>
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

      <Dialog>
        <SchemaExplorer>
          <SchemaExplorer.Header>
            <DialogTrigger asChild>
              <DbSettings.TriggerButton />
            </DialogTrigger>
            <SchemaExplorer.RefreshButton />
          </SchemaExplorer.Header>
          <SchemaExplorer.Tree className="h-full" />
        </SchemaExplorer>

        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>Database Settings</DialogTitle>
          </DialogHeader>
          <Tabs
            defaultValue="connections"
            className="flex min-h-0 w-full flex-col"
          >
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="connections" className="flex-1">
                Connections
              </TabsTrigger>
              <TabsTrigger value="drivers" className="flex-1">
                <DbSettings.DriversTabLabel />
              </TabsTrigger>
            </TabsList>
            <div className="mt-4 grid min-h-0 overflow-y-auto [&>*]:col-start-1 [&>*]:row-start-1">
              <TabsContent
                value="connections"
                forceMount
                className="space-y-4 data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
              >
                <DbSettings.Connections />
              </TabsContent>
              <TabsContent
                value="drivers"
                forceMount
                className="data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
              >
                <DbSettings.Diagnostics />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </RoomPanel>
  );
};
