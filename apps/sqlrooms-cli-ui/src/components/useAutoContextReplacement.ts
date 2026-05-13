import {useEffect} from 'react';
import {useRoomStore} from '../store';
import {isContextArtifactType} from './assistantUtils';

/**
 * Hook that automatically replaces AI context with current artifact in auto mode
 * when the session is empty and has no prompt
 */
export function useAutoContextReplacement() {
  const aiContextMode = useRoomStore((s) => s.aiContextMode);
  const currentPrompt = useRoomStore(
    (s) => s.ai.getCurrentSession()?.prompt ?? '',
  );
  const sessionIsEmpty = useRoomStore((s) => {
    const session = s.ai.getCurrentSession();
    if (!session) return true;
    const hasMessages = session.uiMessages.length > 0;
    const hasCompletedResults = session.analysisResults.some(
      (result) => result.id !== '__pending__',
    );
    return !hasMessages && !hasCompletedResults;
  });
  const currentArtifactId = useRoomStore(
    (s) => s.artifacts.config.currentArtifactId,
  );
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const replaceAiContextWithArtifact = useRoomStore(
    (s) => s.replaceAiContextWithArtifact,
  );

  const currentArtifact = currentArtifactId
    ? artifactsById[currentArtifactId]
    : undefined;

  useEffect(() => {
    if (
      aiContextMode === 'auto' &&
      sessionIsEmpty &&
      currentPrompt.trim().length === 0 &&
      currentArtifactId &&
      currentArtifact &&
      isContextArtifactType(currentArtifact.type)
    ) {
      replaceAiContextWithArtifact(currentArtifactId);
    }
  }, [
    aiContextMode,
    sessionIsEmpty,
    currentPrompt,
    currentArtifactId,
    currentArtifact,
    replaceAiContextWithArtifact,
  ]);
}
