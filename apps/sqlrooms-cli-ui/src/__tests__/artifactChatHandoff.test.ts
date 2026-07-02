import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {createArtifactChatHandoffController} from '../artifactChatHandoff';
import type {RoomState} from '../store-types';

const sourceArtifactId = 'source-worksheet';
const targetArtifactId = 'target-worksheet';
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
  prompt = 'create a new worksheet with the same chart',
  targetBlocks = [],
}: {
  prompt?: string;
  targetBlocks?: any[];
} = {}) {
  const blocksByArtifact: Record<string, any[]> = {
    [sourceArtifactId]: [
      {
        id: 'source-chart',
        type: 'chart',
        tableName: '"main"."cars"',
        config: {chartType: 'scatter', settings: {x: 'Weight', y: 'MPG'}},
        caption: 'MPG vs Weight',
      },
    ],
    [targetArtifactId]: targetBlocks,
  };

  const appendBlocks = jest.fn((artifactId: string, blocks: any[]) => {
    blocksByArtifact[artifactId] = [
      ...(blocksByArtifact[artifactId] ?? []),
      ...blocks,
    ];
  });
  const setSessionArtifact = jest.fn();
  const setSessionDraftContextItemIds = jest.fn();
  const setSessionRunContext = jest.fn();
  const selectLatestSessionForArtifact = jest.fn();
  const forkSessionFromMessage = jest.fn(() => targetSessionId);
  const artifactsConfig = {currentArtifactId: targetArtifactId};
  const setCurrentArtifact = jest.fn((artifactId: string) => {
    artifactsConfig.currentArtifactId = artifactId;
  });

  const state = {
    ai: {
      config: {
        sessions: [
          {
            id: sourceSessionId,
            uiMessages: [userMessage(prompt)],
          },
        ],
      },
      forkSessionFromMessage,
      getSessionRunContext: jest.fn(() => ({
        items: [
          {
            kind: 'artifact',
            id: sourceArtifactId,
            type: 'worksheet',
            title: 'Source Worksheet',
          },
        ],
      })),
      setSessionDraftContextItemIds,
      setSessionRunContext,
    },
    artifactAi: {
      getSessionArtifactId: jest.fn((sessionId: string) =>
        sessionId === sourceSessionId ? sourceArtifactId : targetArtifactId,
      ),
      setSessionArtifact,
      selectLatestSessionForArtifact,
    },
    artifacts: {
      config: artifactsConfig,
      getArtifact: jest.fn((artifactId: string) => {
        if (artifactId === sourceArtifactId) {
          return {
            id: sourceArtifactId,
            type: 'worksheet',
            title: 'Source Worksheet',
          };
        }
        if (artifactId === targetArtifactId) {
          return {
            id: targetArtifactId,
            type: 'worksheet',
            title: 'Target Worksheet',
          };
        }
        return undefined;
      }),
      setCurrentArtifact,
    },
    blockDocuments: {
      getBlocks: jest.fn((artifactId: string) => blocksByArtifact[artifactId]),
      appendBlocks,
    },
  } as unknown as RoomState;

  return {
    appendBlocks,
    blocksByArtifact,
    forkSessionFromMessage,
    selectLatestSessionForArtifact,
    setCurrentArtifact,
    setSessionArtifact,
    setSessionDraftContextItemIds,
    setSessionRunContext,
    state,
  };
}

async function triggerHandoff(state: RoomState) {
  const controller = createArtifactChatHandoffController({
    getState: () => state,
  } as any);
  await controller.commandMiddleware(
    {id: 'block-document.create'} as any,
    undefined,
    {
      getState: () => state,
      invocation: {
        surface: 'ai',
        metadata: {aiSessionId: sourceSessionId},
      },
    } as any,
    async () => ({
      success: true,
      data: {
        artifactTargetChange: {
          artifactId: targetArtifactId,
          artifactType: 'worksheet',
          title: 'Target Worksheet',
          change: 'created',
          shouldContinueChat: true,
        },
      },
    }),
  );
  expect(state.artifacts.config.currentArtifactId).toBe(sourceArtifactId);
  controller.onChatFinish({
    sessionId: sourceSessionId,
    messages: [
      userMessage('create a new worksheet with the same chart'),
      assistantMessage(),
    ],
  });
}

describe('createArtifactChatHandoffController', () => {
  it('copies source chart blocks into an empty target for same-chart handoff', async () => {
    const {
      appendBlocks,
      blocksByArtifact,
      setCurrentArtifact,
      setSessionArtifact,
      setSessionDraftContextItemIds,
      state,
    } = createState();

    await triggerHandoff(state);

    expect(appendBlocks).toHaveBeenCalledTimes(1);
    expect(appendBlocks).toHaveBeenCalledWith(targetArtifactId, [
      expect.objectContaining({
        type: 'chart',
        tableName: '"main"."cars"',
        caption: 'MPG vs Weight',
      }),
    ]);
    expect(blocksByArtifact[targetArtifactId][0].id).not.toBe('source-chart');
    expect(setSessionArtifact).toHaveBeenCalledWith(
      targetSessionId,
      targetArtifactId,
    );
    expect(setSessionArtifact).toHaveBeenCalledWith(
      sourceSessionId,
      sourceArtifactId,
    );
    expect(setSessionDraftContextItemIds).toHaveBeenCalledWith(
      sourceSessionId,
      undefined,
    );
    expect(setSessionDraftContextItemIds).toHaveBeenCalledWith(
      targetSessionId,
      undefined,
    );
    expect(setCurrentArtifact).toHaveBeenNthCalledWith(1, sourceArtifactId);
    expect(setCurrentArtifact).toHaveBeenLastCalledWith(targetArtifactId);
  });

  it('does not copy chart blocks when the target was already populated', async () => {
    const {appendBlocks, state} = createState({
      targetBlocks: [
        {
          id: 'target-chart',
          type: 'chart',
          tableName: '"main"."cars"',
          config: {chartType: 'scatter'},
        },
      ],
    });

    await triggerHandoff(state);

    expect(appendBlocks).not.toHaveBeenCalled();
  });
});
