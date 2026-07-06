import {
  setAiRunContextPrimaryItem,
  type AiRunContext,
} from '@sqlrooms/ai-config';
import type {UIMessage} from 'ai';
import type {StoreApi} from 'zustand';
import type {ArtifactMetadata} from '../ArtifactsSliceConfig';
import type {RoomStateWithArtifactAi} from './artifactAiSlice';
import type {ArtifactTargetChange} from './artifactTargetChange';

type ForkSessionFromMessageArgs = {
  sourceSessionId: string;
  sourceMessageId: string;
  sourceMessageIndex: number;
  name?: string;
};

/**
 * Minimal room state needed by the artifact AI chat handoff controller.
 */
export type ArtifactAiChatHandoffState = RoomStateWithArtifactAi & {
  ai: RoomStateWithArtifactAi['ai'] & {
    forkSessionFromMessage: (
      args: ForkSessionFromMessageArgs,
    ) => string | undefined;
    getSessionRunContext: (sessionId: string) => AiRunContext | undefined;
    setSessionRunContext: (
      sessionId: string,
      runContext: AiRunContext | undefined,
    ) => void;
    setSessionDraftContextItemIds: (
      sessionId: string,
      itemIds: string[] | undefined,
    ) => void;
  };
};

type ArtifactAiChatHandoffStore<TState extends ArtifactAiChatHandoffState> =
  Pick<StoreApi<TState>, 'getState'>;

type ArtifactAiCommand = {
  id: string;
};

type ArtifactAiCommandInvocation = {
  surface?: string;
  metadata?: Record<string, unknown>;
};

type ArtifactAiCommandContext<TState extends ArtifactAiChatHandoffState> = {
  getState: () => TState;
  invocation: ArtifactAiCommandInvocation;
};

export type ArtifactAiCommandMiddleware<
  TState extends ArtifactAiChatHandoffState,
> = (
  command: ArtifactAiCommand,
  input: unknown,
  context: ArtifactAiCommandContext<TState>,
  next: () => Promise<unknown>,
) => Promise<unknown>;

export type ArtifactAiChatHandoffMessageSummary = {
  id: string;
  text: string;
};

export type ArtifactAiChatHandoffHookContext<
  TState extends ArtifactAiChatHandoffState,
> = {
  state: TState;
  commandId: string;
  sourceArtifact: ArtifactMetadata;
  targetArtifact: ArtifactMetadata;
  sourceSessionId: string;
  sourceUserMessage: ArtifactAiChatHandoffMessageSummary;
  targetChange: ArtifactTargetChange;
};

export type ArtifactAiChatHandoffTargetForkContext<
  TState extends ArtifactAiChatHandoffState,
> = ArtifactAiChatHandoffHookContext<TState> & {
  messages: UIMessage[];
  assistantMessage: UIMessage;
  assistantMessageIndex: number;
};

export type ArtifactAiChatHandoffAfterTargetForkContext<
  TState extends ArtifactAiChatHandoffState,
> = ArtifactAiChatHandoffTargetForkContext<TState> & {
  targetSessionId: string;
};

export type CreateArtifactAiChatHandoffControllerOptions<
  TState extends ArtifactAiChatHandoffState,
> = {
  /** Store containing artifact ownership and AI session state. */
  store: ArtifactAiChatHandoffStore<TState>;
  /** Optional predicate for apps that only support handoff for some artifacts. */
  isSupportedArtifact?: (artifact: ArtifactMetadata) => boolean;
  /**
   * Optional app policy for whether an artifact target change should become a
   * forked chat handoff.
   */
  shouldContinueChat?: (
    context: ArtifactAiChatHandoffHookContext<TState> & {
      result: unknown;
    },
  ) => boolean;
  /**
   * Runs after a pending handoff is recorded and before the source artifact is
   * restored for the still-running turn.
   */
  onBeforeSourceRestore?: (
    context: ArtifactAiChatHandoffHookContext<TState>,
  ) => void;
  /** Runs after the target session is forked and bound to the target artifact. */
  onAfterTargetFork?: (
    context: ArtifactAiChatHandoffAfterTargetForkContext<TState>,
  ) => void;
};

type PendingArtifactAiChatHandoff = {
  sourceSessionId: string;
  sourceArtifactId: string;
  sourceUserMessage: ArtifactAiChatHandoffMessageSummary;
  target: ArtifactTargetChange;
  commandId: string;
};

/**
 * Reads package-owned artifact target change metadata from a command result.
 *
 * @param result - Command result that may include `data.artifactTargetChange`.
 * @returns A validated artifact target change, or `undefined`.
 */
export function readArtifactTargetChange(
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
    if (message?.role === 'user' && typeof message.id === 'string') {
      return {
        id: message.id,
        text: getMessageText(message),
      };
    }
  }
  return undefined;
}

function createArtifactContextItem(artifact: ArtifactMetadata) {
  return {
    kind: 'artifact',
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
  };
}

/**
 * Creates command and chat-finish hooks that continue artifact-scoped AI chats
 * in a fork when an AI-invoked command changes the active artifact.
 *
 * The controller owns generic artifact/session choreography. Apps inject policy
 * for supported artifact types and artifact-specific content behavior through
 * hooks.
 */
export function createArtifactAiChatHandoffController<
  TState extends ArtifactAiChatHandoffState,
>({
  store,
  isSupportedArtifact,
  shouldContinueChat,
  onBeforeSourceRestore,
  onAfterTargetFork,
}: CreateArtifactAiChatHandoffControllerOptions<TState>) {
  const pendingHandoffs = new Map<string, PendingArtifactAiChatHandoff>();

  const commandMiddleware: ArtifactAiCommandMiddleware<TState> = async (
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
      target.artifactId === sourceArtifactId
    ) {
      return result;
    }

    const nextState = store.getState();
    const targetArtifact = nextState.artifacts.getArtifact(target.artifactId);
    if (!targetArtifact) return result;
    if (isSupportedArtifact && !isSupportedArtifact(targetArtifact)) {
      return result;
    }
    const sourceArtifact = nextState.artifacts.getArtifact(sourceArtifactId);
    if (!sourceArtifact) return result;
    if (isSupportedArtifact && !isSupportedArtifact(sourceArtifact)) {
      return result;
    }
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

    const hookContext: ArtifactAiChatHandoffHookContext<TState> = {
      state: nextState,
      commandId: command.id,
      sourceArtifact,
      targetArtifact,
      sourceSessionId,
      sourceUserMessage,
      targetChange: {
        ...target,
        title: targetArtifact.title,
        artifactType: targetArtifact.type,
      },
    };

    if (shouldContinueChat && !shouldContinueChat({...hookContext, result})) {
      return result;
    }

    pendingHandoffs.set(sourceSessionId, {
      sourceSessionId,
      sourceArtifactId,
      sourceUserMessage,
      target: hookContext.targetChange,
      commandId: command.id,
    });
    onBeforeSourceRestore?.(hookContext);

    nextState.artifactAi.setSessionArtifact(sourceSessionId, sourceArtifactId);
    nextState.ai.setSessionDraftContextItemIds(sourceSessionId, undefined);
    nextState.ai.setSessionRunContext(
      sourceSessionId,
      setAiRunContextPrimaryItem(
        nextState.ai.getSessionRunContext(sourceSessionId),
        createArtifactContextItem(sourceArtifact),
      ),
    );
    nextState.artifacts.setCurrentArtifact(sourceArtifactId);

    return result;
  };

  const onChatFinish = ({
    sessionId,
    messages,
    isError,
  }: {
    sessionId: string;
    messages: UIMessage[];
    isError?: boolean;
  }) => {
    const handoff = pendingHandoffs.get(sessionId);
    if (!handoff) return;
    pendingHandoffs.delete(sessionId);
    if (isError) return;

    const state = store.getState();
    const sourceArtifact = state.artifacts.getArtifact(
      handoff.sourceArtifactId,
    );
    if (!sourceArtifact) return;
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
    if (getLastUserMessageId(messages) !== handoff.sourceUserMessage.id) {
      return;
    }

    const targetForkContext: ArtifactAiChatHandoffTargetForkContext<TState> = {
      state,
      commandId: handoff.commandId,
      sourceArtifact,
      targetArtifact,
      sourceSessionId: handoff.sourceSessionId,
      sourceUserMessage: handoff.sourceUserMessage,
      targetChange: {
        ...handoff.target,
        title: targetArtifact.title,
        artifactType: targetArtifact.type,
      },
      messages,
      assistantMessage: assistantMessage.message,
      assistantMessageIndex: assistantMessage.index,
    };
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
        createArtifactContextItem(targetArtifact),
      ),
    );
    state.artifacts.setCurrentArtifact(targetArtifact.id);
    state.artifactAi.selectLatestSessionForArtifact(targetArtifact.id);

    onAfterTargetFork?.({
      ...targetForkContext,
      targetSessionId,
    });
  };

  return {commandMiddleware, onChatFinish};
}
