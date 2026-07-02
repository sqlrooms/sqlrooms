import {setAiRunContextPrimaryItem} from '@sqlrooms/ai';
import type {ArtifactTargetChange} from '@sqlrooms/artifacts/ai';
import {
  createDefaultBlockDocumentBlockId,
  type BlockDocumentBlockType,
} from '@sqlrooms/documents';
import type {RoomCommandMiddleware} from '@sqlrooms/room-shell';
import type {UIMessage} from 'ai';
import type {StoreApi} from 'zustand';
import {CLI_ARTIFACT_TYPES} from './artifactTypeIds';
import type {RoomState} from './store-types';

type PendingArtifactChatHandoff = {
  sourceSessionId: string;
  sourceArtifactId: string;
  sourceUserMessageId: string;
  shouldCopySourceChartBlocks: boolean;
  target: ArtifactTargetChange;
  commandId: string;
};

const SUPPORTED_HANDOFF_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);

function readArtifactTargetChange(
  result: unknown,
): ArtifactTargetChange | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const data = (result as {data?: unknown}).data;
  if (!data || typeof data !== 'object') return undefined;
  const candidate = (data as {artifactTargetChange?: unknown})
    .artifactTargetChange;
  if (!candidate || typeof candidate !== 'object') return undefined;

  const record = candidate as Record<string, unknown>;
  if (
    typeof record.artifactId !== 'string' ||
    typeof record.artifactType !== 'string' ||
    typeof record.title !== 'string' ||
    (record.change !== 'created' && record.change !== 'selected')
  ) {
    return undefined;
  }

  return {
    artifactId: record.artifactId,
    artifactType: record.artifactType,
    title: record.title,
    change: record.change,
    ...(typeof record.shouldContinueChat === 'boolean'
      ? {shouldContinueChat: record.shouldContinueChat}
      : {}),
  };
}

function getInvocationAiSessionId(metadata?: Record<string, unknown>) {
  const aiSessionId = metadata?.aiSessionId;
  return typeof aiSessionId === 'string' ? aiSessionId : undefined;
}

function getLastAssistantMessage(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      return {message, index};
    }
  }
  return undefined;
}

function getLastUserMessageId(
  messages: ReadonlyArray<{id?: string; role?: string}>,
) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'user' && typeof message.id === 'string') {
      return message.id;
    }
  }
  return undefined;
}

function getMessageText(message: UIMessage | undefined): string {
  if (!message) return '';

  return (
    message.parts
      ?.map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text;
        }
        return '';
      })
      .join(' ') ?? ''
  );
}

function getLastUserMessage(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'user') {
      return {
        id: message.id,
        text: getMessageText(message),
      };
    }
  }
  return undefined;
}

function isSameChartRequest(text: string) {
  const normalized = text.toLowerCase();
  return (
    /\bsame\s+chart\b/.test(normalized) ||
    /\bcopy\s+(?:the\s+)?chart\b/.test(normalized) ||
    /\bduplicate\s+(?:the\s+)?chart\b/.test(normalized)
  );
}

function cloneChartBlocks(blocks: BlockDocumentBlockType[]) {
  return blocks
    .filter((block) => block.type === 'chart')
    .map((block) => ({
      ...structuredClone(block),
      id: createDefaultBlockDocumentBlockId(),
    })) as BlockDocumentBlockType[];
}

function copySourceChartBlocksToEmptyTarget(
  state: RoomState,
  sourceArtifactId: string,
  targetArtifactId: string,
) {
  const targetBlocks = state.blockDocuments.getBlocks(targetArtifactId);
  if (targetBlocks.length > 0) return;

  const chartBlocks = cloneChartBlocks(
    state.blockDocuments.getBlocks(sourceArtifactId),
  );
  if (chartBlocks.length === 0) return;

  state.blockDocuments.appendBlocks(targetArtifactId, chartBlocks);
}

/**
 * Creates the command and chat-finish hooks that continue an artifact-scoped
 * AI chat when an AI-invoked command switches to another artifact.
 *
 * @param store - The CLI room store used to inspect artifact and AI session state.
 * @returns Hooks for command middleware and completed chat turns.
 */
export function createArtifactChatHandoffController(
  store: StoreApi<RoomState>,
) {
  const pendingHandoffs = new Map<string, PendingArtifactChatHandoff>();

  const commandMiddleware: RoomCommandMiddleware<RoomState> = async (
    command,
    _input,
    context,
    next,
  ) => {
    const sourceSessionId = getInvocationAiSessionId(
      context.invocation.metadata,
    );
    const sourceArtifactId = sourceSessionId
      ? context.getState().artifactAi.getSessionArtifactId(sourceSessionId)
      : undefined;

    const result = await next();
    if (
      !sourceSessionId ||
      !sourceArtifactId ||
      context.invocation.surface !== 'ai'
    ) {
      return result;
    }

    const target = readArtifactTargetChange(result);
    if (
      !target ||
      target.shouldContinueChat === false ||
      target.artifactId === sourceArtifactId ||
      !SUPPORTED_HANDOFF_ARTIFACT_TYPES.has(target.artifactType)
    ) {
      return result;
    }

    const nextState = store.getState();
    const targetArtifact = nextState.artifacts.getArtifact(target.artifactId);
    if (!targetArtifact) return result;
    const sourceArtifact = nextState.artifacts.getArtifact(sourceArtifactId);
    if (!sourceArtifact) return result;
    if (nextState.artifacts.config.currentArtifactId !== target.artifactId) {
      return result;
    }
    const sourceSession = nextState.ai.config.sessions.find(
      (session) => session.id === sourceSessionId,
    );
    const sourceUserMessage = getLastUserMessage(
      (sourceSession?.uiMessages ?? []) as UIMessage[],
    );
    if (!sourceUserMessage?.id) return result;

    pendingHandoffs.set(sourceSessionId, {
      sourceSessionId,
      sourceArtifactId,
      sourceUserMessageId: sourceUserMessage.id,
      shouldCopySourceChartBlocks: isSameChartRequest(sourceUserMessage.text),
      target: {
        ...target,
        title: targetArtifact.title,
        artifactType: targetArtifact.type,
      },
      commandId: command.id,
    });
    nextState.artifactAi.setSessionArtifact(sourceSessionId, sourceArtifactId);
    nextState.ai.setSessionDraftContextItemIds(sourceSessionId, undefined);
    nextState.ai.setSessionRunContext(
      sourceSessionId,
      setAiRunContextPrimaryItem(
        nextState.ai.getSessionRunContext(sourceSessionId),
        {
          kind: 'artifact',
          id: sourceArtifactId,
          type: sourceArtifact.type,
          title: sourceArtifact.title,
        },
      ),
    );
    nextState.artifacts.setCurrentArtifact(sourceArtifactId);

    return result;
  };

  const onChatFinish = ({
    sessionId,
    messages,
  }: {
    sessionId: string;
    messages: UIMessage[];
  }) => {
    const handoff = pendingHandoffs.get(sessionId);
    if (!handoff) return;
    pendingHandoffs.delete(sessionId);

    const state = store.getState();
    const targetArtifact = state.artifacts.getArtifact(
      handoff.target.artifactId,
    );
    if (!targetArtifact) return;
    if (
      state.artifactAi.getSessionArtifactId(handoff.sourceSessionId) !==
      handoff.sourceArtifactId
    ) {
      return;
    }
    const currentArtifactId = state.artifacts.config.currentArtifactId;
    if (
      currentArtifactId !== handoff.sourceArtifactId &&
      currentArtifactId !== handoff.target.artifactId
    ) {
      return;
    }

    const assistantMessage = getLastAssistantMessage(messages);
    if (!assistantMessage) return;
    if (getLastUserMessageId(messages) !== handoff.sourceUserMessageId) {
      return;
    }

    if (handoff.shouldCopySourceChartBlocks) {
      copySourceChartBlocksToEmptyTarget(
        state,
        handoff.sourceArtifactId,
        targetArtifact.id,
      );
    }

    const targetSessionId = state.ai.forkSessionFromMessage({
      sourceSessionId: handoff.sourceSessionId,
      sourceMessageId: assistantMessage.message.id,
      sourceMessageIndex: assistantMessage.index,
      name: `Continue: ${targetArtifact.title}`,
    });
    if (!targetSessionId) return;

    state.artifactAi.setSessionArtifact(targetSessionId, targetArtifact.id);
    state.ai.setSessionDraftContextItemIds(targetSessionId, undefined);
    state.ai.setSessionRunContext(
      targetSessionId,
      setAiRunContextPrimaryItem(
        state.ai.getSessionRunContext(targetSessionId),
        {
          kind: 'artifact',
          id: targetArtifact.id,
          type: targetArtifact.type,
          title: targetArtifact.title,
        },
      ),
    );
    state.artifacts.setCurrentArtifact(targetArtifact.id);
    state.artifactAi.selectLatestSessionForArtifact(targetArtifact.id);
  };

  return {commandMiddleware, onChatFinish};
}
