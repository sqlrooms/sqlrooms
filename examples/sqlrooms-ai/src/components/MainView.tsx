import {ProjectPanelTypes, useProjectStore} from '../store/store';
import {useEffect} from 'react';
import {QueryControls, AnalysisResultsContainer} from '@sqlrooms/ai';
import {KeyIcon} from 'lucide-react';
import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

export const MainView: React.FC = () => {
  // const isDataAvailable = useProjectStore((s) => s.isDataAvailable);
  const analysisResults = useProjectStore(
    (s) => s.project.config.ai.analysisResults,
  );
  const togglePanel = useProjectStore((s) => s.project.togglePanel);
  const addDataSource = useProjectStore((s) => s.project.addDataSource);
  const apiKey = useProjectStore((s) => s.openAiApiKey);
  const setApiKey = useProjectStore((s) => s.setOpenAiApiKey);
  const selectedModel = useProjectStore((s) => s.selectedModel);
  const setSelectedModel = useProjectStore((s) => s.setSelectedModel);
  const supportedModels = useProjectStore((s) => s.supportedModels);

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
      <div
        className={cn(
          'w-full min-h-[200px] transition-all duration-300 ease-in-out pb-12',
          analysisResults.length > 0 ? 'border-t' : 'flex-1 max-w-5xl mx-auto',
        )}
      >
        <QueryControls />
        <div className="flex items-center justify-end gap-2 px-4">
          <div className="flex items-center relative">
            <KeyIcon className="w-4 h-4 absolute left-2 text-gray-400" />
            <Input
              type="password"
              placeholder="OpenAI API Key"
              value={apiKey || ''}
              onChange={(e) => setApiKey(e.target.value)}
              className="pl-8 w-[200px] bg-gray-800"
            />
          </div>
          <Select value={selectedModel || ''} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px] bg-gray-800">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {supportedModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
