import {
  findAiSessionForArtifactWithContextItem,
  type ArtifactAiSessionOwnership,
  type ArtifactAiSessionWithContext,
} from '@sqlrooms/artifacts/ai';
import {toast} from '@sqlrooms/ui';
import {blockContextItemId, type BlockAiTarget} from './BlockAiTarget';

/**
 * Minimal artifact shape needed to validate a block-document Ask AI target.
 */
export type StartBlockScopedChatArtifact = {
  type: string;
};

/**
 * Host-provided actions used by {@link startBlockScopedChat}.
 *
 * Apps adapt their room store into this bag so the shared helper stays free of
 * product-specific store imports.
 */
export type StartBlockScopedChatActions = {
  getArtifact: (artifactId: string) => StartBlockScopedChatArtifact | undefined;
  getCurrentArtifactId: () => string | undefined;
  setCurrentArtifact: (artifactId: string) => void;
  getAiSessions: () => ArtifactAiSessionWithContext[];
  getAiSessionArtifacts: () => ArtifactAiSessionOwnership;
  createArtifactScopedSession: () => string | undefined;
  switchSession: (sessionId: string) => void;
  getSessionDraftContextItemIds: (sessionId: string) => string[] | undefined;
  setSessionDraftContextItemIds: (sessionId: string, ids: string[]) => void;
  setPrompt: (sessionId: string, prompt: string) => void;
  startAnalysisWhenReady: (sessionId: string) => Promise<boolean>;
};

export type StartBlockScopedChatOptions = {
  target: BlockAiTarget;
  prompt: string;
  revealAssistant: () => void;
  actions: StartBlockScopedChatActions;
  /**
   * Returns true when the artifact can host block-scoped Ask AI.
   * Callers supply product-specific checks (for example block-document artifacts).
   */
  isValidBlockDocumentArtifact: (
    artifact: StartBlockScopedChatArtifact,
  ) => boolean;
  /**
   * Precomputed context item id. When omitted, derived via {@link blockContextItemId}.
   */
  contextItemId?: string;
  /**
   * Optional product noun used in toast copy.
   * Defaults to "block document".
   */
  artifactLabel?: string;
};

/**
 * Opens or reuses an artifact-scoped AI session for a specific block target,
 * seeds the block into draft context, and starts analysis with the given prompt.
 */
export async function startBlockScopedChat({
  target,
  prompt,
  revealAssistant,
  actions,
  isValidBlockDocumentArtifact,
  contextItemId: contextItemIdOption,
  artifactLabel = 'block document',
}: StartBlockScopedChatOptions): Promise<void> {
  const artifactId = target.blockDocumentId;
  const artifact = actions.getArtifact(artifactId);

  if (!artifact || !isValidBlockDocumentArtifact(artifact)) {
    toast.error('Cannot ask AI about this block', {
      description: `The ${artifactLabel} for this block is no longer available.`,
    });
    return;
  }

  if (actions.getCurrentArtifactId() !== artifactId) {
    actions.setCurrentArtifact(artifactId);
  }

  const contextItemId = contextItemIdOption ?? blockContextItemId(target);
  const sessions = actions.getAiSessions();
  const aiSessionArtifacts = actions.getAiSessionArtifacts();

  const runningSessionId = findAiSessionForArtifactWithContextItem({
    sessions,
    aiSessionArtifacts,
    artifactId,
    contextItemId,
    includeRunning: true,
  });

  if (runningSessionId) {
    toast.error('An AI chat is already running for this block');
    actions.switchSession(runningSessionId);
    return;
  }

  const existingSessionId = findAiSessionForArtifactWithContextItem({
    sessions,
    aiSessionArtifacts,
    artifactId,
    contextItemId,
  });

  const sessionId = existingSessionId ?? actions.createArtifactScopedSession();

  if (!sessionId) {
    toast.error('Cannot start an AI chat for this block');
    return;
  }

  if (existingSessionId) {
    actions.switchSession(existingSessionId);
  }

  const draftContextItemIds =
    actions.getSessionDraftContextItemIds(sessionId) ?? [];
  if (!draftContextItemIds.includes(contextItemId)) {
    actions.setSessionDraftContextItemIds(sessionId, [
      ...draftContextItemIds,
      contextItemId,
    ]);
  }

  revealAssistant();
  actions.setPrompt(sessionId, prompt);
  const didStart = await actions.startAnalysisWhenReady(sessionId);
  if (!didStart) {
    toast.error('Could not start the AI chat', {
      description: 'The assistant did not open in time. Please try again.',
    });
  }
}
