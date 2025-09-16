import {useState} from 'react';
import {Button, SkeletonPane} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {
  AiSettingsPanel,
  AnalysisResultsContainer,
  SessionControls,
  QueryControls,
  getDefaultInstructions,
  ModelSelector,
  extractModelsFromConfig,
} from '@sqlrooms/ai';
import {useBaseRoomShellStore} from '@sqlrooms/room-shell';
import {useRoomStore} from '../store';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.config.ai.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);
  const aiSettings = useRoomStore((s) => s.config.aiSettings);

  const tables = useBaseRoomShellStore((s) => s.db.tables);

  const getDefaultInstructionsWrapper = () => {
    return getDefaultInstructions(tables);
  };

  const models = extractModelsFromConfig(aiSettings);

  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      <div className="relative mb-4">
        <SessionControls className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
        <Button
          variant="outline"
          className="hover:bg-accent absolute right-0 top-0 flex h-8 w-8 items-center justify-center transition-colors"
          onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
          title="Configuration"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {isConfigPanelOpen ? (
        <div className="flex-grow overflow-auto">
          {currentSessionId && (
            <AiSettingsPanel isOpen={true} setIsOpen={setIsConfigPanelOpen}>
              <AiSettingsPanel.ProvidersConfig />
              <AiSettingsPanel.ModelsConfig />
              <AiSettingsPanel.ModelParameters
                getDefaultInstructions={getDefaultInstructionsWrapper}
              />
            </AiSettingsPanel>
          )}
        </div>
      ) : (
        <>
          <div className="flex-grow overflow-auto">
            {isDataAvailable ? (
              <AnalysisResultsContainer
                key={currentSessionId} // will prevent scrolling to bottom after changing current session
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center">
                <SkeletonPane className="p-4" />
                <p className="text-muted-foreground mt-4">
                  Loading database...
                </p>
              </div>
            )}
          </div>

          <QueryControls placeholder="Type here what would you like to learn about the data? Something like 'What is the max magnitude of the earthquakes by year?'">
            <div className="flex items-center justify-end gap-2">
              <ModelSelector models={models} />
            </div>
          </QueryControls>
        </>
      )}
    </div>
  );
};
