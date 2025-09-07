import {useMemo} from 'react';
import {AssistantPanel} from '@sqlrooms/ai-chatui';
import {useRoomStore} from '../store';
import {LLM_MODELS} from '../models';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.config.ai.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);

  // Transform LLM_MODELS into the format expected by ModelSelector
  const modelOptions = useMemo(
    () =>
      LLM_MODELS.flatMap((provider) =>
        provider.models.map((model) => ({
          provider: provider.name,
          label: model,
          value: model,
        })),
      ),
    [],
  );

  const getModelStatus = () => ({
    isReady: true,
    error: undefined,
  });

  return (
    <AssistantPanel
      currentSessionId={currentSessionId}
      getModelStatus={getModelStatus}
      isDataAvailable={isDataAvailable}
      supportUrl="https://github.com/sqlrooms/sqlrooms/issues"
      modelOptions={modelOptions}
    />
  );
};
