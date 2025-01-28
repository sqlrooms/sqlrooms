import {ProjectPanelTypes} from '@/store/demo-project-config';
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
} from '@sqlrooms/ui';
import {FileTextIcon, FolderIcon, TableIcon} from 'lucide-react';
import {FC, useMemo} from 'react';

const DataSourcesPanel: FC = () => {
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);
  const dataSources = useBaseProjectStore(
    (state) => state.projectConfig.dataSources,
  );
  const queryDataSources = useMemo(
    () => dataSources.filter((ds) => ds.type === DataSourceTypes.enum.sql),
    [dataSources],
  );

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['data-sources']}>
      <Accordion type="multiple" defaultValue={['files', 'sql', 'tables']}>
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
              <SqlQueryDataSourcesPanel queryDataSources={queryDataSources} />
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
    </ProjectBuilderPanel>
  );
};

export {DataSourcesPanel};
