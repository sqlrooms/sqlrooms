import type {
  AiSessionForkOrigin,
  AiSliceConfig,
  ChatSessionSchema,
} from '@sqlrooms/ai-config';
import type {UIMessage} from 'ai';
import {getChatTurnsFromUiMessages} from './chatTurns';

export type ForkSessionFromMessageArgs = {
  sourceSessionId: string;
  sourceMessageId?: string;
  sourceTurnId?: string;
  sourceMessageIndex?: number;
  legacySourceAnalysisResultId?: string;
  name?: string;
};

export type CreatedChatSessionFork = {
  forkedSession: ChatSessionSchema;
  forkOrigin: AiSessionForkOrigin;
};

export function cleanupSessionForks(config: AiSliceConfig): AiSliceConfig {
  const sessionIds = new Set(config.sessions.map((session) => session.id));
  const existingSessionForks = config.sessionForks ?? {};
  const sessionForks = Object.fromEntries(
    Object.entries(existingSessionForks).filter(([targetSessionId]) =>
      sessionIds.has(targetSessionId),
    ),
  );

  if (
    config.sessionForks &&
    Object.keys(sessionForks).length ===
      Object.keys(existingSessionForks).length
  ) {
    return config;
  }

  return {
    ...config,
    sessionForks,
  };
}

function getToolCallIdsFromMessages(
  messages: ChatSessionSchema['uiMessages'],
): Set<string> {
  const toolCallIds = new Set<string>();
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const toolCallId = (part as {toolCallId?: unknown}).toolCallId;
      if (typeof toolCallId === 'string') {
        toolCallIds.add(toolCallId);
      }
    }
  }
  return toolCallIds;
}

export function getForkedAgentProgress({
  sourceSession,
  targetMessages,
}: {
  sourceSession: ChatSessionSchema;
  targetMessages: ChatSessionSchema['uiMessages'];
}): ChatSessionSchema['agentProgress'] | undefined {
  if (!sourceSession.agentProgress) return undefined;

  const copiedToolCallIds = getToolCallIdsFromMessages(targetMessages);
  const agentProgress = Object.fromEntries(
    Object.entries(sourceSession.agentProgress).filter(([toolCallId]) =>
      copiedToolCallIds.has(toolCallId),
    ),
  );

  return Object.keys(agentProgress).length > 0
    ? (structuredClone(agentProgress) as ChatSessionSchema['agentProgress'])
    : undefined;
}

export function getForkedAgentSnapshots({
  sourceSession,
  targetMessages,
}: {
  sourceSession: ChatSessionSchema;
  targetMessages: ChatSessionSchema['uiMessages'];
}): ChatSessionSchema['agentSnapshots'] | undefined {
  if (!sourceSession.agentSnapshots) return undefined;

  const copiedToolCallIds = getToolCallIdsFromMessages(targetMessages);
  const agentSnapshots = Object.fromEntries(
    Object.entries(sourceSession.agentSnapshots).filter(([toolCallId]) =>
      copiedToolCallIds.has(toolCallId),
    ),
  );

  return Object.keys(agentSnapshots).length > 0
    ? (structuredClone(agentSnapshots) as ChatSessionSchema['agentSnapshots'])
    : undefined;
}

export function createForkedChatSessionFromMessage({
  sourceSession,
  args,
  targetSessionId,
  now,
}: {
  sourceSession: ChatSessionSchema;
  args: ForkSessionFromMessageArgs;
  targetSessionId: string;
  now: number;
}): CreatedChatSessionFork | undefined {
  const sourceMessages = sourceSession.uiMessages as UIMessage[];
  const sourceTurns = getChatTurnsFromUiMessages(sourceMessages, {
    isRunning: sourceSession.isRunning,
  });
  let sourceTurn = args.sourceTurnId
    ? sourceTurns.find((turn) => turn.id === args.sourceTurnId)
    : args.legacySourceAnalysisResultId
      ? sourceTurns.find(
          (turn) => turn.id === args.legacySourceAnalysisResultId,
        )
      : undefined;

  let sourceMessageIndex =
    typeof args.sourceMessageIndex === 'number' ? args.sourceMessageIndex : -1;

  if (sourceMessageIndex < 0 && args.sourceMessageId) {
    sourceMessageIndex = sourceMessages.findIndex(
      (message) => message.id === args.sourceMessageId,
    );
  }

  if (sourceMessageIndex < 0 && sourceTurn) {
    const turnMessageIds = new Set([
      sourceTurn.userMessage.id,
      ...sourceTurn.assistantMessages.map((message) => message.id),
    ]);
    for (let index = sourceMessages.length - 1; index >= 0; index--) {
      const message = sourceMessages[index];
      if (message && turnMessageIds.has(message.id)) {
        sourceMessageIndex = index;
        break;
      }
    }
  }

  if (sourceMessageIndex < 0 || sourceMessageIndex >= sourceMessages.length) {
    return undefined;
  }

  const selectedMessage = sourceMessages[sourceMessageIndex];
  if (!selectedMessage) return undefined;
  if (selectedMessage.role !== 'assistant') return undefined;

  if (!sourceTurn) {
    if (args.sourceTurnId || args.legacySourceAnalysisResultId) {
      return undefined;
    }
    sourceTurn = sourceTurns.find((turn) =>
      turn.assistantMessages.some(
        (message) => message.id === selectedMessage.id,
      ),
    );
  }
  if (!sourceTurn) return undefined;
  if (!sourceTurn.isCompleted) return undefined;

  const selectedMessageBelongsToTurn = sourceTurn.assistantMessages.some(
    (message) => message.id === selectedMessage.id,
  );
  if (!selectedMessageBelongsToTurn) {
    return undefined;
  }

  const targetMessages = structuredClone(
    sourceMessages.slice(0, sourceMessageIndex + 1),
  ) as ChatSessionSchema['uiMessages'];
  const draftContextItemIds = sourceSession.draftContextItemIds
    ? Array.from(new Set(sourceSession.draftContextItemIds))
    : undefined;
  const agentProgress = getForkedAgentProgress({
    sourceSession,
    targetMessages,
  });
  const agentSnapshots = getForkedAgentSnapshots({
    sourceSession,
    targetMessages,
  });
  const forkedSession: ChatSessionSchema = {
    id: targetSessionId,
    name: args.name ?? `Fork of ${sourceSession.name || 'Untitled'}`,
    modelProvider: sourceSession.modelProvider,
    model: sourceSession.model,
    ...(sourceSession.customModelName
      ? {customModelName: sourceSession.customModelName}
      : {}),
    ...(sourceSession.baseUrl ? {baseUrl: sourceSession.baseUrl} : {}),
    createdAt: new Date(now),
    uiMessages: targetMessages,
    messagesRevision: 0,
    prompt: '',
    ...(draftContextItemIds ? {draftContextItemIds} : {}),
    ...(!draftContextItemIds && sourceSession.runContext
      ? {
          runContext: structuredClone(sourceSession.runContext),
        }
      : {}),
    ...(agentProgress ? {agentProgress} : {}),
    ...(agentSnapshots ? {agentSnapshots} : {}),
    isRunning: false,
    lastOpenedAt: now,
  };
  const forkOrigin: AiSessionForkOrigin = {
    sourceSessionId: sourceSession.id,
    sourceMessageId: selectedMessage.id,
    sourceTurnId: sourceTurn.id,
    sourceMessageIndex,
    ...(args.legacySourceAnalysisResultId
      ? {
          legacySourceAnalysisResultId: args.legacySourceAnalysisResultId,
        }
      : {}),
    sourceSessionNameAtFork: sourceSession.name,
    createdAt: now,
  };

  return {forkedSession, forkOrigin};
}
