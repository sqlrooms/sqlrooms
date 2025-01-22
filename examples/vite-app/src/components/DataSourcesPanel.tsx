import {
  FileDataSourcesPanel,
  ProjectBuilderPanel,
  SqlQueryDataSourcesPanel,
  TablesListPanel,
  useBaseProjectStore,
} from '@sqlrooms/project-builder';
import {DataSourceTypes} from '@sqlrooms/project-config';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from '@sqlrooms/ui';
import {FileTextIcon, FolderIcon, PlusIcon, TableIcon} from 'lucide-react';
import {FC, useCallback, useMemo, useState} from 'react';
import {ProjectPanelTypes} from '../store/schemas';

export type DataSourcesPanelProps = {
  AddDataModal: React.ComponentType<{isOpen: boolean; onClose: () => void}>;
};

const DataSourcesPanel: FC<DataSourcesPanelProps> = ({
  AddDataModal = () => null,
}) => {
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);
  const [isOpen, setIsOpen] = useState(false);
  const projectFiles = useBaseProjectStore((state) => state.projectFiles);
  const dataSources = useBaseProjectStore(
    (state) => state.projectConfig.dataSources,
  );
  const queryDataSources = useMemo(
    () => dataSources.filter((ds) => ds.type === DataSourceTypes.enum.sql),
    [dataSources],
  );

  const isProjectEmpty = !projectFiles?.length;

  const handleModalClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['data-sources']}>
      {!isReadOnly && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="py-4"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Add
        </Button>
      )}
      {isProjectEmpty ? (
        <></>
      ) : (
        <>
          <div className="flex overflow-auto flex-col items-stretch">
            <Accordion
              type="multiple"
              defaultValue={['files', 'sql', 'tables']}
            >
              <AccordionItem value="files">
                <AccordionTrigger className="px-0 gap-1">
                  <div className="flex items-center text-muted-foreground">
                    <FolderIcon className="h-4 w-4" />
                    <h3 className="ml-1 text-xs uppercase">Files</h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5 pt-1 px-[5px]">
                  <FileDataSourcesPanel />
                </AccordionContent>
              </AccordionItem>

              {!isReadOnly || queryDataSources.length > 0 ? (
                <AccordionItem value="sql">
                  <AccordionTrigger className="px-0 gap-1">
                    <div className="flex items-center text-muted-foreground">
                      <FileTextIcon className="h-4 w-4" />
                      <h3 className="ml-1 text-xs uppercase">SQL Queries</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 pt-1 px-[5px]">
                    <SqlQueryDataSourcesPanel
                      queryDataSources={queryDataSources}
                    />
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              <AccordionItem value="tables">
                <AccordionTrigger className="px-0 gap-1">
                  <div className="flex items-center text-muted-foreground">
                    <TableIcon className="h-4 w-4" />
                    <h3 className="ml-1 text-xs uppercase">Tables</h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5 pt-1 px-[5px]">
                  <TablesListPanel />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </>
      )}

      {AddDataModal ? (
        <AddDataModal isOpen={isOpen} onClose={handleModalClose} />
      ) : null}
    </ProjectBuilderPanel>
  );
};

export default DataSourcesPanel;
