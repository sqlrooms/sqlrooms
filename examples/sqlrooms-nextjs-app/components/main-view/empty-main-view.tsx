import {useProjectStore} from '@/store/demo-project-store';
import {DemoPanels} from '@/store/initial-project-state';
import {FileDropzone} from '@sqlrooms/dropzone';

export const EmptyMainView: React.FC = () => {
  const addProjectFile = useProjectStore((state) => state.addProjectFile);
  const togglePanel = useProjectStore((state) => state.togglePanel);
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-4">
        <h2 className="font-bold text-xl">Add data to analyze</h2>
        <FileDropzone
          className="max-w-md min-w-[300px] h-[200px] p-5"
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
            togglePanel(DemoPanels.DATA_SOURCES, true);
          }}
        >
          <div className="text-xs text-muted-foreground">
            Files you add will stay local to your browser.
          </div>
        </FileDropzone>
      </div>
    </div>
  );
};
