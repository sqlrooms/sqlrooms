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

function createState() {
  const appendBlocks = jest.fn();
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
            uiMessages: [
              userMessage('create a new worksheet with the same chart'),
            ],
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
      appendBlocks,
    },
  } as unknown as RoomState;

  return {
    appendBlocks,
    forkSessionFromMessage,
    selectLatestSessionForArtifact,
    setCurrentArtifact,
    setSessionArtifact,
    setSessionDraftContextItemIds,
    state,
  };
}

describe('createArtifactChatHandoffController', () => {
  it('hands off worksheet chats without hidden block document copying', async () => {
    const {
      appendBlocks,
      forkSessionFromMessage,
      selectLatestSessionForArtifact,
      setCurrentArtifact,
      setSessionArtifact,
      setSessionDraftContextItemIds,
      state,
    } = createState();
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

    expect(appendBlocks).not.toHaveBeenCalled();
    expect(forkSessionFromMessage).toHaveBeenCalledWith({
      sourceSessionId,
      sourceMessageId: 'assistant-1',
      sourceMessageIndex: 1,
      name: 'Continue: Target Worksheet',
    });
    expect(setSessionArtifact).toHaveBeenCalledWith(
      sourceSessionId,
      sourceArtifactId,
    );
    expect(setSessionArtifact).toHaveBeenCalledWith(
      targetSessionId,
      targetArtifactId,
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
    expect(selectLatestSessionForArtifact).toHaveBeenCalledWith(
      targetArtifactId,
    );
  });
});
