import {expect, it, jest} from '@jest/globals';
import type {
  RegisteredRoomCommand,
  RoomCommandExecutionContext,
} from '@sqlrooms/room-shell';
import {artifactChatAssociationMiddleware} from '../artifactChatAssociation';
import type {RoomState} from '../store-types';

it('links a newly selected artifact to the invoking chat and keeps it selected', async () => {
  const sourceSessionId = 'source-session';
  const sourceArtifactId = 'document-a';
  const targetArtifactId = 'document-b';
  const addSessionArtifactLink = jest.fn();
  const switchSession = jest.fn();
  const artifactsById: Record<
    string,
    {id: string; type: string; title: string}
  > = {
    [sourceArtifactId]: {
      id: sourceArtifactId,
      type: 'document',
      title: 'Document A',
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
    {id: 'document.create'} as RegisteredRoomCommand<RoomState>,
    undefined,
    context,
    async () => {
      state.artifacts.config.artifactsById[targetArtifactId] = {
        id: targetArtifactId,
        type: 'document',
        title: 'Document B',
      };
      state.artifacts.config.currentArtifactId = targetArtifactId;
      return {artifactId: targetArtifactId};
    },
  );

  expect(result).toEqual({artifactId: targetArtifactId});
  expect(addSessionArtifactLink).toHaveBeenCalledWith(
    sourceSessionId,
    targetArtifactId,
  );
  expect(switchSession).toHaveBeenCalledWith(sourceSessionId);
});

it('does not associate an artifact that was created without being selected', async () => {
  const addSessionArtifactLink = jest.fn();
  const artifactsById: Record<
    string,
    {id: string; type: string; title: string}
  > = {
    'document-a': {
      id: 'document-a',
      type: 'document',
      title: 'Document A',
    },
    'document-b': {
      id: 'document-b',
      type: 'document',
      title: 'Document B',
    },
  };
  const state = {
    artifacts: {
      config: {
        currentArtifactId: 'document-a',
        artifactsById,
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
    {id: 'document.create'} as RegisteredRoomCommand<RoomState>,
    undefined,
    context,
    async () => ({
      success: true,
      commandId: 'document.create',
      data: {artifactId: 'document-b'},
    }),
  );

  expect(addSessionArtifactLink).not.toHaveBeenCalled();
});
