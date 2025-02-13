'use client';
import {FileDropzone} from '@sqlrooms/dropzone';
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
import {ProjectPanelTypes, useProjectStore} from '../store/store';

const DataSourcesPanel: FC = () => {
  const addProjectFile = useProjectStore(
    (state) => state.project.addProjectFile,
  );

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['data-sources']}>
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
            await addProjectFile(file);
          }
        }}
      >
        <div className="text-xs text-muted-foreground">
          Files you add will stay local to your browser.
        </div>
      </FileDropzone>

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
