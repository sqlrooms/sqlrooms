import {setAiRunContextPrimaryItem} from '@sqlrooms/ai';
import type {ArtifactTargetChange} from '@sqlrooms/artifacts/ai';
import type {RoomCommandMiddleware} from '@sqlrooms/room-shell';
import type {UIMessage} from 'ai';
import type {StoreApi} from 'zustand';
import {CLI_ARTIFACT_TYPES} from './artifactTypeIds';
import type {RoomState} from './store-types';

type PendingArtifactChatHandoff = {
  sourceSessionId: string;
  sourceArtifactId: string;
  sourceUserMessageId?: string;
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

function getLastUserMessage(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'user') {
      return message;
    }
  }
  return undefined;
}

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
    if (nextState.artifacts.config.currentArtifactId !== target.artifactId) {
      return result;
    }

    pendingHandoffs.set(sourceSessionId, {
      sourceSessionId,
      sourceArtifactId,
      sourceUserMessageId: getLastUserMessage(
        nextState.ai.getSession(sourceSessionId)?.uiMessages ?? [],
      )?.id,
      target: {
        ...target,
        title: targetArtifact.title,
        artifactType: targetArtifact.type,
      },
      commandId: command.id,
    });

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
    if (
      state.artifacts.config.currentArtifactId !== handoff.target.artifactId
    ) {
      return;
    }

    const assistantMessage = getLastAssistantMessage(messages);
    if (!assistantMessage) return;
    if (getLastUserMessage(messages)?.id !== handoff.sourceUserMessageId) {
      return;
    }

    const targetSessionId = state.ai.forkSessionFromMessage({
      sourceSessionId: handoff.sourceSessionId,
      sourceMessageId: assistantMessage.message.id,
      sourceMessageIndex: assistantMessage.index,
      name: `Continue: ${targetArtifact.title}`,
    });
    if (!targetSessionId) return;

    state.artifactAi.setSessionArtifact(targetSessionId, targetArtifact.id);
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
    state.artifactAi.selectLatestSessionForArtifact(targetArtifact.id);
  };

  return {commandMiddleware, onChatFinish};
}
