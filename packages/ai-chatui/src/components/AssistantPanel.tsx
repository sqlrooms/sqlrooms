import {SessionControls, AnalysisResultsContainer, QueryControls} from '@sqlrooms/ai';
import {RoomPanel} from '@sqlrooms/room-shell';
import {SkeletonPane} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {useState, FC} from 'react';
import {AiConfigPanel} from './AiConfigPanel';
import {ModelUsageData} from '../types';

interface AssistantPanelProps {
  currentSessionId: string | null;
  getModelStatus: () => {isReady: boolean; error?: string};
  supportUrl: string;
  // Model options
  modelOptions: Array<{provider: string; label: string; value: string}>;
  // Optional model usage data
  modelUsage?: ModelUsageData;
  // Base URL function
  getProxyBaseUrl: () => string;
}

export const AssistantPanel: FC<AssistantPanelProps> = ({
  currentSessionId,
  getModelStatus,
  supportUrl,
  modelOptions,
  modelUsage,
  getProxyBaseUrl
}) => {
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  // Get model status
  const {isReady, error: modelError} = getModelStatus();

  return (
    <RoomPanel type="assistant" className="overflow-hidden">
      <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
        <div className="mb-4 relative">
          <SessionControls className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
          <button
            className="absolute right-0 top-0 flex items-center justify-center w-8 h-8 hover:bg-accent transition-colors"
            onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
            title="Configuration"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {isConfigPanelOpen ? (
          <div className="flex-grow overflow-auto">
            <AiConfigPanel
              isOpen={true}
              setIsOpen={setIsConfigPanelOpen}
              modelOptions={modelOptions}
              modelUsage={modelUsage}
              getProxyBaseUrl={getProxyBaseUrl}
            />
          </div>
        ) : (
          <>
            <div className="flex-grow overflow-auto">
              <AnalysisResultsContainer
                key={currentSessionId} // will prevent scrolling to bottom after changing current session
              />
            </div>

            {!isReady ? (
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <p className="text-left p-6 text-red-500 text-sm">
                  ⚠️ The AI assistant is currently unavailable. {modelError && `Error: ${modelError}`} Please try restarting the
                  application or{' '}
                  <a
                    href={supportUrl}
                    className="underline hover:text-red-600"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    contact support
                  </a>{' '}
                  if the issue persists.
                </p>
              </div>
            ) : (
              <QueryControls placeholder="Type here what would you like to learn about the data? Something like 'What is the max magnitude of the earthquakes by year?'" />
            )}
          </>
        )}
      </div>
    </RoomPanel>
  );
};
