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
import {KeplerS3Browser} from './KeplerS3Browser';
import type {KeplerS3BrowserProps} from '../index';
import {useIntl} from 'react-intl';

const DEFAULT_ACCEPTED_FORMATS = [
  'csv',
  'tsv',
  'parquet',
  'json',
  'arrow',
  'shp',
  'kml',
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
    label: 'Local File',
    value: AddDataMethods.Upload,
  },
  {
    label: 'Tiles',
    value: AddDataMethods.TileSet,
  },
  // {
  //   label: 'S3',
  //   value: AddDataMethods.S3,
  // },
];

export type KeplerAddDataDialogProps = {
  addDataModal: Pick<UseDisclosureReturnValue, 'isOpen' | 'onClose'>;
  loadTileSet: LoadTileSet;
  loadFiles: (files: FileList | string[]) => Promise<void>;
  method?: AddDataMethods;
  acceptedFormats?: string[];
} & KeplerS3BrowserProps;

export const KeplerAddDataDialog = ({
  addDataModal,
  loadTileSet,
  loadFiles,
  listS3Files,
  loadS3Files,
  saveS3Credential,
  loadS3Credentials,
  deleteS3Credential,
  s3Browser,
  method = AddDataMethods.Upload,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
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
    async (...args: Parameters<KeplerS3BrowserProps['loadS3Files']>) => {
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
        <DialogContent className="min-w-md h-[80vh] max-w-4xl grid-rows-[auto,1fr]">
          <DialogHeader>
            <DialogTitle>Add Data</DialogTitle>
            <DialogDescription>
              Add data to the project.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            defaultValue={currentMethod}
            className="flex h-full w-full flex-col gap-4 overflow-auto"
            onValueChange={(value) =>
              selectCurrentMethod(value as AddDataMethods)
            }
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
                  {acceptedFormats ? (
                    <div className="text-muted-foreground flex flex-wrap justify-center gap-2 opacity-80">
                      {acceptedFormats.map((ext) => (
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
              className="h-full w-full overflow-auto data-[state=inactive]:hidden"
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
              <KeplerS3Browser
                listS3Files={listS3Files}
                s3Browser={s3Browser}
                loadS3Files={onLoadS3Files}
                saveS3Credential={saveS3Credential}
                loadS3Credentials={loadS3Credentials}
                deleteS3Credential={deleteS3Credential}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </KeplerProvider>
  );
};
