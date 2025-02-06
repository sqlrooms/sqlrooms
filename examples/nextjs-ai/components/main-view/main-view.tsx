'use client';
import {useProjectStore} from '@/store/store';
import {EmptyMainView} from './empty-main-view';
import {QueryControls} from './query-controls';
import {AnalysisResultsContainer} from './analysis-results-container';

export const MainView: React.FC = () => {
  const isDataAvailable = useProjectStore((s) => s.isDataAvailable);
  const analysisResults = useProjectStore(
    (s) => s.projectConfig.analysisResults,
  );

  if (!isDataAvailable) {
    return <EmptyMainView />;
  }

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
