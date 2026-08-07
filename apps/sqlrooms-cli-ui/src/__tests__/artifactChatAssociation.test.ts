import {expect, it, jest} from '@jest/globals';
import type {
  RegisteredRoomCommand,
  RoomCommandExecutionContext,
} from '@sqlrooms/room-shell';
import {artifactChatAssociationMiddleware} from '../artifactChatAssociation';
import type {RoomState} from '../store-types';

it('links a newly selected artifact to the invoking chat and keeps it selected', async () => {
  const sourceSessionId = 'source-session';
  const sourceArtifactId = 'worksheet-a';
  const targetArtifactId = 'worksheet-b';
  const addSessionArtifactLink = jest.fn();
  const switchSession = jest.fn();
  const artifactsById: Record<
    string,
    {id: string; type: string; title: string}
  > = {
    [sourceArtifactId]: {
      id: sourceArtifactId,
      type: 'worksheet',
      title: 'Worksheet A',
    },
  };
  const state = {
    artifacts: {
      config: {
        currentArtifactId: sourceArtifactId,
        artifactsById,
      },
      getArtifact: (artifactId: string) =>
        state.artifacts.config.artifactsById[artifactId],
    },
    artifactAi: {addSessionArtifactLink},
    ai: {
      config: {
        sessions: [{id: sourceSessionId}],
        currentSessionId: undefined as string | undefined,
      },
      switchSession,
    },
  };
  const context = {
    getState: () => state,
    invocation: {
      surface: 'ai' as const,
      metadata: {aiSessionId: sourceSessionId},
    },
  } as unknown as RoomCommandExecutionContext<RoomState>;

  const result = await artifactChatAssociationMiddleware(
    {id: 'worksheet.create'} as RegisteredRoomCommand<RoomState>,
    undefined,
    context,
    async () => {
      state.artifacts.config.artifactsById[targetArtifactId] = {
        id: targetArtifactId,
        type: 'worksheet',
        title: 'Worksheet B',
      };
      state.artifacts.config.currentArtifactId = targetArtifactId;
      return {
        success: true,
        commandId: 'worksheet.create',
        data: {artifactId: targetArtifactId},
      };
    },
  );

  expect(result.success).toBe(true);
  expect(addSessionArtifactLink).toHaveBeenCalledWith(
    sourceSessionId,
    targetArtifactId,
    'created',
  );
  expect(switchSession).toHaveBeenCalledWith(sourceSessionId);
});

it('does not associate an artifact that was created without being selected', async () => {
  const addSessionArtifactLink = jest.fn();
  const state = {
    artifacts: {
      config: {
        currentArtifactId: 'worksheet-a',
        artifactsById: {
          'worksheet-a': {
            id: 'worksheet-a',
            type: 'worksheet',
            title: 'Worksheet A',
          },
          'worksheet-b': {
            id: 'worksheet-b',
            type: 'worksheet',
            title: 'Worksheet B',
          },
        },
      },
      getArtifact: (artifactId: string) =>
        state.artifacts.config.artifactsById[artifactId],
    },
    artifactAi: {addSessionArtifactLink},
    ai: {
      config: {
        sessions: [{id: 'source-session'}],
        currentSessionId: 'source-session',
      },
      switchSession: jest.fn(),
    },
  };
  const context = {
    getState: () => state,
    invocation: {
      surface: 'ai' as const,
      metadata: {aiSessionId: 'source-session'},
    },
  } as unknown as RoomCommandExecutionContext<RoomState>;

  await artifactChatAssociationMiddleware(
    {id: 'worksheet.create'} as RegisteredRoomCommand<RoomState>,
    undefined,
    context,
    async () => ({
      success: true,
      commandId: 'worksheet.create',
      data: {artifactId: 'worksheet-b'},
    }),
  );

  expect(addSessionArtifactLink).not.toHaveBeenCalled();
});
