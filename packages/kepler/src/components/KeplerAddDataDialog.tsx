import {useCallback, useState} from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  UseDisclosureReturnValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {LoadTileSetFactory, Icons} from '@kepler.gl/components';
import {FileDropInput} from './FileDropInput';
import {KeplerInjector} from './KeplerInjector';
import {KeplerProvider} from './KeplerProvider';
import {S3Browser, S3BrowserProps} from './S3Browser';
import {useIntl} from 'react-intl';

const ACCEPTED_FORMATS = [
  'csv',
  'tsv',
  'parquet',
  'json',
  'arrow',
  'shp',
  'klm',
];

const LoadTileSet = KeplerInjector.get(LoadTileSetFactory);
export type LoadTileSet = (args: {
  tileset: {name: string; type: string; metadata: Record<string, any>};
  metadata?: Record<string, any>;
}) => void;

function LoadTileSetContent({
  loadTileSet,
  onClose,
}: {
  loadTileSet: LoadTileSet;
  onClose?: () => void;
}) {
  const intl = useIntl();
  const onTilesetAdded = useCallback(
    (
      tileset: {name: string; type: string; metadata: Record<string, any>},
      metadata?: Record<string, any>,
    ) => {
      loadTileSet({tileset, metadata});
      onClose?.();
    },
    [loadTileSet, onClose],
  );
  return <LoadTileSet intl={intl} onTilesetAdded={onTilesetAdded} />;
}

export enum AddDataMethods {
  Upload = 'upload',
  TileSet = 'tileset',
  S3 = 's3',
}
const ADD_DATA_METHODS = [
  {
    label: 'Upload',
    value: AddDataMethods.Upload,
  },
  {
    label: 'TileSet',
    value: AddDataMethods.TileSet,
  },
  {
    label: 'S3',
    value: AddDataMethods.S3,
  },
];

export type KeplerAddDataDialogProps = {
  addDataModal: Pick<UseDisclosureReturnValue, 'isOpen' | 'onClose'>;
  loadTileSet: LoadTileSet;
  loadFiles: (files: FileList | string[]) => Promise<void>;
  method?: AddDataMethods;
} & S3BrowserProps;

export const KeplerAddDataDialog = ({
  addDataModal,
  loadTileSet,
  loadFiles,
  listS3Files,
  loadS3Files,
  saveS3Connection,
  loadS3Connections,
  deleteS3Connection,
  s3,
  method = AddDataMethods.Upload,
}: KeplerAddDataDialogProps) => {
  const [currentMethod, selectCurrentMethod] = useState<AddDataMethods>(method);
  const onFileDrop = useCallback(
    (files: FileList) => {
      loadFiles(files);
      addDataModal.onClose();
    },
    [loadFiles, addDataModal],
  );
  const onLoadS3Files = useCallback(
    async (...args: Parameters<S3BrowserProps['loadS3Files']>) => {
      await loadS3Files(...args);
      addDataModal.onClose();
    },
    [loadS3Files, addDataModal],
  );
  return (
    <KeplerProvider mapId={''}>
      <Dialog
        open={addDataModal.isOpen}
        onOpenChange={(isOpen: boolean) => !isOpen && addDataModal.onClose()}
      >
        <DialogContent className="min-w-md min-h-[600px] max-w-4xl grid-rows-[auto,1fr]">
          <DialogHeader>
            <DialogTitle>Add Data</DialogTitle>
            <DialogDescription>
              Add data from local files, S3, or Tilesets. Data stays in your
              local machine and is not uploaded to the cloud.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            defaultValue={currentMethod}
            className="flex h-full w-full flex-col gap-4"
            onValueChange={selectCurrentMethod}
          >
            <TabsList className="flex h-10 items-center justify-start gap-1">
              {ADD_DATA_METHODS.map(({value, label}) => (
                <TabsTrigger
                  value={value}
                  className="flex items-center gap-2"
                  key={value}
                >
                  <span className="text-muted-foreground">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/** File Upload */}
            <TabsContent
              value={AddDataMethods.Upload}
              className="h-full w-full data-[state=inactive]:hidden"
            >
              <div className="h-min-[200px] flex h-full w-full items-center justify-center">
                <FileDropInput onFileDrop={onFileDrop}>
                  {ACCEPTED_FORMATS ? (
                    <div className="text-muted-foreground flex flex-wrap justify-center gap-2 opacity-80">
                      {ACCEPTED_FORMATS.map((ext) => (
                        <Icons.FileType
                          key={ext}
                          ext={ext}
                          height="50px"
                          fontSize="9px"
                        />
                      ))}
                    </div>
                  ) : null}
                </FileDropInput>
              </div>
            </TabsContent>

            {/** TileSet*/}
            <TabsContent
              value={AddDataMethods.TileSet}
              className="h-full w-full data-[state=inactive]:hidden"
            >
              <LoadTileSetContent
                loadTileSet={loadTileSet}
                onClose={addDataModal.onClose}
              />
            </TabsContent>
            {/** S3 */}
            <TabsContent
              value={AddDataMethods.S3}
              className="h-full w-full data-[state=inactive]:hidden"
            >
              <S3Browser
                listS3Files={listS3Files}
                s3={s3}
                loadS3Files={onLoadS3Files}
                saveS3Connection={saveS3Connection}
                loadS3Connections={loadS3Connections}
                deleteS3Connection={deleteS3Connection}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </KeplerProvider>
  );
};
