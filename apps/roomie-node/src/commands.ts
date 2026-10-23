import {blockDocumentContentToBlocks} from '@sqlrooms/documents';
import type {RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {createRoomieCommands} from '../../roomie-cli-ui/src/commands';
import type {RoomState} from '../../roomie-cli-ui/src/RoomState';

/** Host-visible content commands; analytical/file effects get separate receipts later. */
export function createHostCommands(): RoomCommand<RoomState>[] {
  return [
    ...createRoomieCommands({
      includeViewState: false,
      resolveLocalFile: async () => {
        throw new Error(
          'File import is not available in the content commit boundary.',
        );
      },
    })
      .filter(
        (command) =>
          command.id.startsWith('block-document.') ||
          command.id.startsWith('dashboard.') ||
          command.id.startsWith('html-app.'),
      )
      .map<RoomCommand<RoomState>>((command) =>
        command.id === 'block-document.create'
          ? {
              ...command,
              execute: (context, input) =>
                command.execute(context, {...(input as object), select: false}),
            }
          : command,
      ),
    {
      id: 'block-document.rename',
      name: 'Rename document',
      inputSchema: z.object({
        artifactId: z.string().min(1),
        title: z.string().min(1),
      }),
      metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const {artifactId, title} = input as {
          artifactId: string;
          title: string;
        };
        if (!getState().artifacts.getArtifact(artifactId))
          throw new Error('Unknown document.');
        getState().artifacts.renameArtifact(artifactId, title);
        return {
          success: true,
          commandId: 'block-document.rename',
          data: {artifactId, title},
        };
      },
    },
  ];
}

/** Validate the revision target against the command's explicit owned instance. */
export function assertCommandTarget(
  state: RoomState,
  commandId: string,
  input: Record<string, unknown>,
  artifactId: string,
) {
  const document = state.blockDocuments.config.artifacts[artifactId];
  if (!document) throw new Error('Unknown document.');
  if (commandId.startsWith('block-document.')) {
    if (input.artifactId !== artifactId)
      throw new Error('An explicit matching artifactId is required.');
  } else {
    const type = commandId.startsWith('dashboard.') ? 'dashboard' : 'html-app';
    const instanceId = type === 'dashboard' ? input.dashboardId : input.appId;
    if (
      !blockDocumentContentToBlocks(document.content).some(
        (block) =>
          block.type === 'statefulBlock' &&
          block.blockType === type &&
          block.blockInstanceId === instanceId &&
          block.ownership === 'owned',
      )
    )
      throw new Error('Instance does not belong to the revision target.');
  }
}
