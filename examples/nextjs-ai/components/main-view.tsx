'use client';
import {ProjectPanelTypes, useProjectStore} from '@/store/store';
import {useEffect} from 'react';
import {QueryControls, AnalysisResultsContainer} from '@sqlrooms/ai';

export const MainView: React.FC = () => {
  // const isDataAvailable = useProjectStore((s) => s.isDataAvailable);
  const analysisResults = useProjectStore(
    (s) => s.projectConfig.ai.analysisResults,
  );
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

  // if (!isDataAvailable) {
  //   return <EmptyMainView />;
  // }

  return (
    <div className="w-full h-full flex flex-col gap-0 overflow-hidden">
      {analysisResults.length > 0 && <AnalysisResultsContainer />}
      <QueryControls
        className={`min-h-[200px] transition-all duration-300 ease-in-out ${
          analysisResults.length > 0 ? 'border-t' : 'flex-1 max-w-5xl mx-auto'
        }`}
      />
    </div>
  );
};
