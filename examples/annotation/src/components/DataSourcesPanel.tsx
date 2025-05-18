import {
  FileDataSourcesPanel,
  ProjectBuilderPanel,
  TablesListPanel,
} from '@sqlrooms/project-builder';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@sqlrooms/ui';
import {FolderIcon, TableIcon} from 'lucide-react';
import {FC} from 'react';
import {ProjectPanelTypes, useProjectStore} from '../store.js';

const DataSourcesPanel: FC = () => {
  const projectFiles = useProjectStore((state) => state.project.projectFiles);
  const isProjectEmpty = !projectFiles?.length;
  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['data-sources']}>
      {isProjectEmpty ? (
        <></>
      ) : (
        <div className="flex flex-col items-stretch overflow-auto">
          <Accordion type="multiple" defaultValue={['files', 'tables']}>
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
      )}
    </ProjectBuilderPanel>
  );
};

export default DataSourcesPanel;
