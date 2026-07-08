import {findAiSessionForArtifactWithContextItem} from '@sqlrooms/artifacts/ai';
import {blockContextItemId, type BlockAiTarget} from '@sqlrooms/documents';
import {toast} from '@sqlrooms/ui';
import {useRoomStore} from '../store';

export async function startBlockScopedChat({
  target,
  prompt,
  revealAssistant,
}: {
  target: BlockAiTarget;
  prompt: string;
  revealAssistant: () => void;
}) {
  const artifactId = target.blockDocumentId;
  const initialState = useRoomStore.getState();
  const artifact = initialState.artifacts.getArtifact(artifactId);

  if (!artifact || artifact.type !== 'worksheet') {
    toast.error('Cannot ask AI about this block', {
      description: 'The worksheet for this block is no longer available.',
    });
    return;
  }

  if (initialState.artifacts.config.currentArtifactId !== artifactId) {
    initialState.artifacts.setCurrentArtifact(artifactId);
  }

  const state = useRoomStore.getState();
  const contextItemId = blockContextItemId(target);
  const matchingSessionId = findAiSessionForArtifactWithContextItem({
    sessions: state.ai.config.sessions,
    aiSessionArtifacts: state.artifactAi.config.aiSessionArtifacts,
    artifactId,
    contextItemId,
    includeRunning: true,
  });
  const runningSessionId = state.ai.config.sessions.find(
    (session) => session.id === matchingSessionId && session.isRunning,
  )?.id;

  if (runningSessionId) {
    toast.error('An AI chat is already running for this block');
    state.ai.switchSession(runningSessionId);
    return;
  }

  const existingSessionId = findAiSessionForArtifactWithContextItem({
    sessions: state.ai.config.sessions,
    aiSessionArtifacts: state.artifactAi.config.aiSessionArtifacts,
    artifactId,
    contextItemId,
  });

  const sessionId =
    existingSessionId ?? state.artifactAi.createArtifactScopedSession();

  if (!sessionId) {
    toast.error('Cannot start an AI chat for this block');
    return;
  }

  if (existingSessionId) {
    state.ai.switchSession(existingSessionId);
  }

  const latestState = useRoomStore.getState();
  const draftContextItemIds =
    latestState.ai.getSessionDraftContextItemIds(sessionId) ?? [];
  if (!draftContextItemIds.includes(contextItemId)) {
    latestState.ai.setSessionDraftContextItemIds(sessionId, [
      ...draftContextItemIds,
      contextItemId,
    ]);
  }

  revealAssistant();
  latestState.ai.setPrompt(sessionId, prompt);
  const didStart = await latestState.ai.startAnalysisWhenReady(sessionId);
  if (!didStart) {
    toast.error('Could not start the AI chat', {
      description: 'The assistant did not open in time. Please try again.',
    });
  }
}
