import type {AiRunContext} from '@sqlrooms/ai-config';
import type {UIMessage} from 'ai';
import {
  createArtifactAiChatHandoffController,
  switchToArtifactAiSession,
  type ArtifactAiChatHandoffState,
} from '../src/ai';

const sourceArtifactId = 'source-artifact';
const targetArtifactId = 'target-artifact';
const sourceSessionId = 'source-session';
const targetSessionId = 'target-session';

function userMessage(text: string): UIMessage {
  return {
    id: 'user-1',
    role: 'user',
    parts: [{type: 'text', text}],
  };
}

function assistantMessage(): UIMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    parts: [{type: 'text', text: 'Done.'}],
  };
}

function createState({
  sourceSessionArtifactId = sourceArtifactId,
}: {
  sourceSessionArtifactId?: string | null;
} = {}) {
  const artifactsConfig = {currentArtifactId: targetArtifactId};
  const operationCalls: string[] = [];
  const setCurrentArtifactCalls: string[] = [];
  const setCurrentArtifact = (artifactId: string) => {
    operationCalls.push(`artifact:${artifactId}`);
    setCurrentArtifactCalls.push(artifactId);
    artifactsConfig.currentArtifactId = artifactId;
  };
  const setSessionArtifactCalls: Array<[string, string]> = [];
  const setSessionArtifact = (sessionId: string, artifactId: string) => {
    setSessionArtifactCalls.push([sessionId, artifactId]);
  };
  const setSessionDraftContextItemIdsCalls: Array<
    [string, string[] | undefined]
  > = [];
  const setSessionDraftContextItemIds = (
    sessionId: string,
    itemIds: string[] | undefined,
  ) => {
    setSessionDraftContextItemIdsCalls.push([sessionId, itemIds]);
  };
  const setSessionRunContextCalls: Array<[string, AiRunContext | undefined]> =
    [];
  const setSessionRunContext = (
    sessionId: string,
    runContext: AiRunContext | undefined,
  ) => {
    setSessionRunContextCalls.push([sessionId, runContext]);
  };
  const selectLatestSessionForArtifactCalls: string[] = [];
  const selectLatestSessionForArtifact = (artifactId?: string) => {
    if (artifactId) {
      selectLatestSessionForArtifactCalls.push(artifactId);
    }
  };
  const forkSessionFromMessageCalls: unknown[] = [];
  const forkSessionFromMessage = (args: unknown) => {
    forkSessionFromMessageCalls.push(args);
    return targetSessionId;
  };
  const switchSessionCalls: string[] = [];
  const switchSession = (sessionId: string) => {
    operationCalls.push(`session:${sessionId}`);
    switchSessionCalls.push(sessionId);
  };

  const state = {
    ai: {
      config: {
        sessions: [
          {
            id: sourceSessionId,
            uiMessages: [userMessage('create a new artifact')],
          },
          {
            id: targetSessionId,
            uiMessages: [],
          },
        ],
      },
      forkSessionFromMessage,
      getSessionRunContext: () =>
        ({
          items: [
            {
              kind: 'artifact',
              id: sourceArtifactId,
              type: 'document',
              title: 'Source Artifact',
            },
          ],
          capturedAt: 1,
        }) satisfies AiRunContext,
      setSessionDraftContextItemIds,
      setSessionRunContext,
      switchSession,
    },
    artifactAi: {
      getSessionArtifactId: (sessionId: string) =>
        sessionId === sourceSessionId
          ? (sourceSessionArtifactId ?? undefined)
          : targetArtifactId,

      setSessionArtifact,
      selectLatestSessionForArtifact,
    },
    artifacts: {
      config: artifactsConfig,
      getArtifact: (artifactId: string) => {
        if (artifactId === sourceArtifactId) {
          return {
            id: sourceArtifactId,
            type: 'document',
            title: 'Source Artifact',
          };
        }
        if (artifactId === targetArtifactId) {
          return {
            id: targetArtifactId,
            type: 'document',
            title: 'Target Artifact',
          };
        }
        return undefined;
      },
      setCurrentArtifact,
    },
  } as unknown as ArtifactAiChatHandoffState;

  return {
    forkSessionFromMessageCalls,
    forkSessionFromMessage,
    operationCalls,
    selectLatestSessionForArtifactCalls,
    selectLatestSessionForArtifact,
    setCurrentArtifactCalls,
    setCurrentArtifact,
    setSessionArtifactCalls,
    setSessionArtifact,
    setSessionDraftContextItemIdsCalls,
    setSessionDraftContextItemIds,
    setSessionRunContextCalls,
    setSessionRunContext,
    state,
    switchSessionCalls,
    switchSession,
  };
}

describe('switchToArtifactAiSession', () => {
  it('selects the owning artifact before switching sessions', () => {
    const {operationCalls, setCurrentArtifactCalls, state, switchSessionCalls} =
      createState();

    expect(
      switchToArtifactAiSession({getState: () => state}, sourceSessionId),
    ).toBe(true);

    expect(setCurrentArtifactCalls).toEqual([sourceArtifactId]);
    expect(switchSessionCalls).toEqual([sourceSessionId]);
    expect(operationCalls).toEqual([
      `artifact:${sourceArtifactId}`,
      `session:${sourceSessionId}`,
    ]);
  });

  it('does nothing for an unknown session', () => {
    const {setCurrentArtifactCalls, state, switchSessionCalls} = createState();

    expect(
      switchToArtifactAiSession({getState: () => state}, 'missing-session'),
    ).toBe(false);

    expect(setCurrentArtifactCalls).toEqual([]);
    expect(switchSessionCalls).toEqual([]);
  });

  it('switches the session without artifact navigation when the session is unowned', () => {
    const {setCurrentArtifactCalls, state, switchSessionCalls} = createState({
      sourceSessionArtifactId: null,
    });

    expect(
      switchToArtifactAiSession({getState: () => state}, sourceSessionId),
    ).toBe(true);

    expect(setCurrentArtifactCalls).toEqual([]);
    expect(switchSessionCalls).toEqual([sourceSessionId]);
  });
});

describe('createArtifactAiChatHandoffController', () => {
  it('restores the source artifact during the turn and forks to the target after finish', async () => {
    const {
      forkSessionFromMessageCalls,
      selectLatestSessionForArtifactCalls,
      setCurrentArtifactCalls,
      setSessionArtifactCalls,
      setSessionDraftContextItemIdsCalls,
      setSessionRunContextCalls,
      state,
    } = createState();
    const beforeSourceRestoreContexts: unknown[] = [];
    const beforeTargetForkContexts: unknown[] = [];
    const afterTargetForkContexts: unknown[] = [];
    const controller = createArtifactAiChatHandoffController({
      store: {getState: () => state},
      onBeforeSourceRestore: (context) =>
        beforeSourceRestoreContexts.push(context),
      onBeforeTargetFork: (context) => beforeTargetForkContexts.push(context),
      onAfterTargetFork: (context) => afterTargetForkContexts.push(context),
    });

    await controller.commandMiddleware(
      {id: 'artifact.create'},
      undefined,
      {
        getState: () => state,
        invocation: {
          surface: 'ai',
          metadata: {aiSessionId: sourceSessionId},
        },
      },
      async () => ({
        success: true,
        data: {
          artifactTargetChange: {
            artifactId: targetArtifactId,
            artifactType: 'document',
            title: 'Target Artifact',
            change: 'created',
            shouldContinueChat: true,
          },
        },
      }),
    );

    expect(beforeSourceRestoreContexts).toEqual([
      expect.objectContaining({
        sourceArtifact: expect.objectContaining({id: sourceArtifactId}),
        targetArtifact: expect.objectContaining({id: targetArtifactId}),
        sourceUserMessage: {id: 'user-1', text: 'create a new artifact'},
      }),
    ]);
    expect(setSessionArtifactCalls).toContainEqual([
      sourceSessionId,
      sourceArtifactId,
    ]);
    expect(setSessionDraftContextItemIdsCalls).toContainEqual([
      sourceSessionId,
      undefined,
    ]);
    expect(setSessionRunContextCalls).toContainEqual([
      sourceSessionId,
      expect.objectContaining({primaryItemId: sourceArtifactId}),
    ]);
    expect(setCurrentArtifactCalls).toContain(sourceArtifactId);

    controller.onChatFinish({
      sessionId: sourceSessionId,
      messages: [userMessage('create a new artifact'), assistantMessage()],
    });

    expect(beforeTargetForkContexts).toEqual([
      expect.objectContaining({
        assistantMessage: expect.objectContaining({id: 'assistant-1'}),
        targetArtifact: expect.objectContaining({id: targetArtifactId}),
      }),
    ]);
    expect(forkSessionFromMessageCalls).toEqual([
      {
        sourceSessionId,
        sourceMessageId: 'assistant-1',
        sourceMessageIndex: 1,
        name: 'Continue: Target Artifact',
      },
    ]);
    expect(setSessionArtifactCalls).toContainEqual([
      targetSessionId,
      targetArtifactId,
    ]);
    expect(setSessionDraftContextItemIdsCalls).toContainEqual([
      targetSessionId,
      undefined,
    ]);
    expect(setSessionRunContextCalls).toContainEqual([
      targetSessionId,
      expect.objectContaining({primaryItemId: targetArtifactId}),
    ]);
    expect(setCurrentArtifactCalls.at(-1)).toBe(targetArtifactId);
    expect(selectLatestSessionForArtifactCalls).toEqual([targetArtifactId]);
    expect(afterTargetForkContexts).toEqual([
      expect.objectContaining({targetSessionId}),
    ]);
  });
});
