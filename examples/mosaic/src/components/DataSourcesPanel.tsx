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
  const roomFiles = useRoomStore((state) => state.room.roomFiles);
  const isRoomEmpty = !roomFiles?.length;

  return (
    <RoomPanel type={RoomPanelTypes.enum['data-sources']}>
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
                <AccordionContent className="px-1.25 pt-1 pb-5">
                  <FileDataSourcesPanel />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tables">
                <AccordionTrigger className="gap-1 px-0">
                  <div className="text-muted-foreground flex items-center">
                    <TableIcon className="h-4 w-4" />
                    <h3 className="ml-1 text-xs uppercase">Tables</h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-1.25 pt-1 pb-5">
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
    </RoomPanel>
  );
};

export default DataSourcesPanel;
