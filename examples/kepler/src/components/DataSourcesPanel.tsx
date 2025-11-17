'use client';
import {FileDropzone} from '@sqlrooms/dropzone';
import {
  FileDataSourcesPanel,
  RoomPanel,
  TablesListPanel,
} from '@sqlrooms/room-shell';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@sqlrooms/ui';
import {FolderIcon, TableIcon} from 'lucide-react';
import {FC} from 'react';
import {RoomPanelTypes, useRoomStore} from '../store';

const DataSourcesPanel: FC = () => {
  const addRoomFile = useRoomStore((state) => state.room.addRoomFile);

  return (
    <RoomPanel type={RoomPanelTypes.enum['data']}>
      <FileDropzone
        className="h-[200px] p-5"
        acceptedFormats={{
          'text/csv': ['.csv'],
          'text/tsv': ['.tsv'],
          'text/parquet': ['.parquet'],
          'text/json': ['.json'],
        }}
        onDrop={async (files) => {
          for (const file of files) {
            await addRoomFile(file);
          }
        }}
      >
        <div className="text-muted-foreground text-xs">
          Files you add will stay local to your browser.
        </div>
      </FileDropzone>

      <Accordion type="multiple" defaultValue={['files', 'sql', 'tables']}>
        <AccordionItem value="files">
          <AccordionTrigger className="gap-1 px-0">
            <div className="text-muted-foreground flex items-center">
              <FolderIcon className="h-4 w-4" />
              <h3 className="ml-1 text-xs uppercase">Files</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-[5px] pb-5 pt-1">
            <FileDataSourcesPanel />
          </AccordionContent>
        </AccordionItem>

        {/* {!isReadOnly || queryDataSources.length > 0 ? (
          <AccordionItem value="sql">
            <AccordionTrigger className="px-0 gap-1">
              <div className="flex items-center text-muted-foreground">
                <FileTextIcon className="h-4 w-4" />
                <h3 className="ml-1 text-xs uppercase">SQL Queries</h3>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5 pt-1 px-[5px]">
              <SqlQueryDataSourcesPanel queryDataSources={queryDataSources} />
            </AccordionContent>
          </AccordionItem>
        ) : null} */}

        <AccordionItem value="tables">
          <AccordionTrigger className="gap-1 px-0">
            <div className="text-muted-foreground flex items-center">
              <TableIcon className="h-4 w-4" />
              <h3 className="ml-1 text-xs uppercase">Tables</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-[5px] pb-5 pt-1">
            <TablesListPanel />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </RoomPanel>
  );
};

export {DataSourcesPanel};
