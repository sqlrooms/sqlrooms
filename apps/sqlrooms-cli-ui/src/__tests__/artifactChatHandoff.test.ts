import {expect, it, jest} from '@jest/globals';
import type {
  RegisteredRoomCommand,
  RoomCommandExecutionContext,
} from '@sqlrooms/room-shell';
import type {UIMessage} from 'ai';
import type {StoreApi} from 'zustand';
import {createArtifactChatHandoffController} from '../artifactChatHandoff';
import type {RoomState} from '../store-types';

it('hands off from the current linked artifact of a multi-artifact session', async () => {
  const sourceSessionId = 'source-session';
  const sourceArtifactId = 'artifact-a';
  const targetArtifactId = 'artifact-b';
  const links = new Set([
    `${sourceSessionId}:${sourceArtifactId}`,
    `${sourceSessionId}:${targetArtifactId}`,
  ]);
  const forkSessionFromMessage = jest.fn(() => 'target-session');
  const setSessionArtifact = jest.fn();
  const setSessionRunContext = jest.fn();
  const selectLatestSessionForArtifact = jest.fn();
  const state = {
    artifacts: {
      config: {currentArtifactId: sourceArtifactId},
      getArtifact: (artifactId: string) =>
        artifactId === targetArtifactId
          ? {
              id: targetArtifactId,
              type: 'document',
              title: 'Target document',
            }
          : undefined,
    },
    artifactAi: {
      hasSessionArtifactLink: (sessionId: string, artifactId: string) =>
        links.has(`${sessionId}:${artifactId}`),
      setSessionArtifact,
      selectLatestSessionForArtifact,
    },
    ai: {
      config: {
        sessions: [
          {
            id: sourceSessionId,
            uiMessages: [{id: 'user-1', role: 'user'}],
          },
        ],
      },
      forkSessionFromMessage,
      getSessionRunContext: jest.fn(() => undefined),
      setSessionRunContext,
    },
  };
  const store = {
    getState: () => state,
  } as unknown as StoreApi<RoomState>;
  const controller = createArtifactChatHandoffController(store);
  const context = {
    getState: () => state,
    invocation: {
      surface: 'ai' as const,
      metadata: {aiSessionId: sourceSessionId},
    },
  } as unknown as RoomCommandExecutionContext<RoomState>;
  const command = {
    id: 'create-target',
  } as RegisteredRoomCommand<RoomState>;

  await controller.commandMiddleware(command, undefined, context, async () => {
    state.artifacts.config.currentArtifactId = targetArtifactId;
    return {
      success: true,
      commandId: command.id,
      data: {
        artifactTargetChange: {
          artifactId: targetArtifactId,
          artifactType: 'document',
          title: 'Target document',
          change: 'selected',
        },
      },
    };
  });
  controller.onChatFinish({
    sessionId: sourceSessionId,
    messages: [
      {id: 'user-1', role: 'user', parts: []},
      {id: 'assistant-1', role: 'assistant', parts: []},
    ] as UIMessage[],
  });

  expect(forkSessionFromMessage).toHaveBeenCalledWith(
    expect.objectContaining({sourceSessionId, sourceMessageId: 'assistant-1'}),
  );
  expect(setSessionArtifact).toHaveBeenCalledWith(
    'target-session',
    targetArtifactId,
  );
  expect(setSessionRunContext).toHaveBeenCalled();
  expect(selectLatestSessionForArtifact).toHaveBeenCalledWith(targetArtifactId);
});
