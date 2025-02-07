import {ProjectPanelTypes} from '@/store/store';
import {useProjectStore} from '@/store/store';
import {FileDropzone} from '@sqlrooms/dropzone';
import {useEffect} from 'react';

export const EmptyMainView: React.FC = () => {
  const addProjectFile = useProjectStore((state) => state.addProjectFile);
  const togglePanel = useProjectStore((state) => state.togglePanel);
  const addDataSource = useProjectStore((s) => s.addDataSource);
  useEffect(() => {
    (async () => {
      await addDataSource({
        tableName: 'earthquakes',
        type: 'url',
        // url: 'https://gist.githubusercontent.com/curran/a08a1080b88344b0c8a7/raw/0e7a9b0a5d22642a06d3d5b9bcbad9890c8ee534/iris.csv',
        url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
      });
      togglePanel(ProjectPanelTypes.enum['data-sources'], true);
    })();
  }, [addDataSource, togglePanel]);
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
            togglePanel(ProjectPanelTypes.enum['data-sources'], true);
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
