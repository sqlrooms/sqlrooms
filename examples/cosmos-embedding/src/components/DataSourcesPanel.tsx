import {
  DataSourceTypes,
  FileDataSourcesPanel,
  RoomShellPanel,
  TablesListPanel,
} from '@sqlrooms/room-shell';
import {SqlQueryDataSourcesPanel} from '@sqlrooms/sql-editor';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@sqlrooms/ui';
import {FileTextIcon, FolderIcon, TableIcon} from 'lucide-react';
import {FC, useMemo} from 'react';
import {RoomPanelTypes, useRoomStore} from '../store';

const DataSourcesPanel: FC<{isReadOnly?: boolean}> = ({isReadOnly}) => {
  const roomFiles = useRoomStore((state) => state.room.roomFiles);
  const dataSources = useRoomStore((state) => state.config.dataSources);
  const queryDataSources = useMemo(
    () => dataSources.filter((ds) => ds.type === DataSourceTypes.enum.sql),
    [dataSources],
  );

  const isRoomEmpty = !roomFiles?.length;

  return (
    <RoomShellPanel type={RoomPanelTypes.enum['data-sources']}>
      {isRoomEmpty ? (
        <></>
      ) : (
        <>
          <div className="flex flex-col items-stretch overflow-auto">
            <Accordion
              type="multiple"
              defaultValue={['files', 'sql', 'tables']}
            >
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

              {!isReadOnly || queryDataSources.length > 0 ? (
                <AccordionItem value="sql">
                  <AccordionTrigger className="gap-1 px-0">
                    <div className="text-muted-foreground flex items-center">
                      <FileTextIcon className="h-4 w-4" />
                      <h3 className="ml-1 text-xs uppercase">SQL Queries</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-[5px] pb-5 pt-1">
                    <SqlQueryDataSourcesPanel
                      queryDataSources={queryDataSources}
                    />
                  </AccordionContent>
                </AccordionItem>
              ) : null}

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
          </div>
        </>
      )}

      {/* {AddDataModal ? (
        <AddDataModal isOpen={isOpen} onClose={handleModalClose} />
      ) : null} */}
    </RoomShellPanel>
  );
};

export default DataSourcesPanel;
