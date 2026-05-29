import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {
  BlocksDocumentBlock,
  BlocksDocumentChartBlock,
  BlocksDocumentContent,
  blocksDocumentBlockToNode,
  createEmptyBlocksDocumentContent,
  type BlocksDocumentBlock as BlocksDocumentBlockType,
} from './BlocksDocumentSliceConfig';
import type {BlocksDocumentsSliceState} from './BlocksDocumentsSlice';

export const BLOCKS_DOCUMENT_COMMAND_SUFFIXES = [
  'list',
  'get',
  'create',
  'append-blocks',
  'insert-blocks',
  'update-block',
  'remove-block',
  'move-block',
  'create-chart-block',
] as const;

export type BlocksDocumentCommandSuffix =
  (typeof BLOCKS_DOCUMENT_COMMAND_SUFFIXES)[number];

export type CreateBlocksDocumentCommandsOptions = {
  artifactType?: string;
  artifactLabel?: string;
  commandNamespace?: string;
  commandGroup?: string;
  defaultTitle?: string;
};

type BlocksDocumentCommandState = BaseRoomStoreState & {
  artifacts: {
    createArtifact: (artifact: {
      type: string;
      id?: string;
      title?: string;
      visibility?: 'workspace' | 'embedded';
      parentArtifactId?: string;
    }) => string;
    setCurrentArtifact: (id?: string) => void;
    getArtifact: (id: string) => ArtifactMetadataType | undefined;
    config: {
      artifactsById: Record<string, ArtifactMetadataType>;
      currentArtifactId?: string;
    };
  };
} & BlocksDocumentsSliceState;

const BlocksDocumentIdInput = z
  .object({
    artifactId: z
      .string()
      .optional()
      .describe('Target blocks document artifact ID.'),
  })
  .default({});

const BlocksDocumentCreateInput = z
  .object({
    title: z.string().optional().describe('Optional artifact title.'),
    blocks: z
      .array(BlocksDocumentBlock)
      .optional()
      .describe('Initial top-level blocks.'),
    select: z
      .boolean()
      .optional()
      .describe('Whether to select the new artifact.'),
  })
  .default({});

const BlocksDocumentBlocksInput = z.object({
  artifactId: z.string().describe('Target blocks document artifact ID.'),
  blocks: z.array(BlocksDocumentBlock).describe('Blocks to add.'),
});

const BlocksDocumentInsertBlocksInput = BlocksDocumentBlocksInput.extend({
  index: z.number().int().describe('Top-level insertion index.'),
});

const BlocksDocumentUpdateBlockInput = z.object({
  artifactId: z.string().describe('Target blocks document artifact ID.'),
  blockId: z.string().describe('Block ID to update.'),
  block: BlocksDocumentBlock.describe('Replacement block. Its id is ignored.'),
});

const BlocksDocumentBlockIdInput = z.object({
  artifactId: z.string().describe('Target blocks document artifact ID.'),
  blockId: z.string().describe('Target block ID.'),
});

const BlocksDocumentMoveBlockInput = BlocksDocumentBlockIdInput.extend({
  toIndex: z.number().int().describe('Destination top-level block index.'),
});

const BlocksDocumentCreateChartBlockInput = z.object({
  artifactId: z.string().describe('Target blocks document artifact ID.'),
  blockId: z.string().optional().describe('Optional explicit chart block ID.'),
  tableName: z.string().describe('Mosaic table name to render.'),
  config: z
    .unknown()
    .describe(
      'Mosaic ChartConfig payload, for example {chartType:"histogram", settings:{field:"revenue"}} or {chartType:"count-plot", settings:{field:"category"}}.',
    ),
  selectionGroupId: z
    .string()
    .optional()
    .describe('Optional crossfilter group for linked chart blocks.'),
  caption: z.string().optional().describe('Optional chart caption.'),
  index: z
    .number()
    .int()
    .optional()
    .describe('Optional top-level insertion index. Defaults to append.'),
});

function lowerLabel(label: string) {
  return label.toLocaleLowerCase();
}

export function createBlocksDocumentCommandIds(
  commandNamespace = 'blocks-document',
) {
  return BLOCKS_DOCUMENT_COMMAND_SUFFIXES.map(
    (suffix) => `${commandNamespace}.${suffix}`,
  );
}

export function createBlocksDocumentCommands<
  TRoomState extends BlocksDocumentCommandState = BlocksDocumentCommandState,
>({
  artifactType = 'blocks-document',
  artifactLabel = 'Blocks Document',
  commandNamespace = 'blocks-document',
  commandGroup = artifactLabel,
  defaultTitle = artifactLabel,
}: CreateBlocksDocumentCommandsOptions = {}): RoomCommand<TRoomState>[] {
  const label = artifactLabel;
  const labelLower = lowerLabel(label);
  const commandId = (suffix: BlocksDocumentCommandSuffix) =>
    `${commandNamespace}.${suffix}`;

  const commandsBySuffix = {
    list: {
      id: commandId('list'),
      name: `List ${labelLower}s`,
      description: `List ${label} artifacts in the room`,
      group: commandGroup,
      keywords: [labelLower, 'document', 'blocks', 'list'],
      metadata: {readOnly: true, idempotent: true, riskLevel: 'low'},
      execute: ({getState}) => {
        const state = getState();
        const documents = Object.values(state.artifacts.config.artifactsById)
          .filter((artifact) => artifact.type === artifactType)
          .map((artifact) => {
            const blocksDocument = state.blocksDocuments.getBlocksDocument(
              artifact.id,
            );
            return {
              artifactId: artifact.id,
              title: artifact.title,
              updatedAt: blocksDocument?.updatedAt,
              blockCount: blocksDocument?.content.content.length ?? 0,
              assetCount: Object.keys(blocksDocument?.assets ?? {}).length,
            };
          });
        return {
          success: true,
          commandId: commandId('list'),
          data: {documents},
        };
      },
    },
    get: {
      id: commandId('get'),
      name: `Get ${labelLower}`,
      description: `Read blocks from a ${label} artifact. Defaults to the current ${labelLower} artifact.`,
      group: commandGroup,
      keywords: [labelLower, 'read', 'get', 'blocks'],
      inputSchema: BlocksDocumentIdInput,
      inputDescription: `Optional ${labelLower} artifact ID. Defaults to the current ${labelLower}.`,
      metadata: {readOnly: true, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId: requestedArtifactId} =
          (input as z.infer<typeof BlocksDocumentIdInput> | undefined) ?? {};
        const artifactId =
          requestedArtifactId ?? state.artifacts.config.currentArtifactId;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('get'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        return {
          success: true,
          commandId: commandId('get'),
          data: readBlocksDocumentData(state, resolved.artifact.id),
        };
      },
    },
    create: {
      id: commandId('create'),
      name: `Create ${labelLower}`,
      description: `Create a ${label} artifact with optional initial blocks`,
      group: commandGroup,
      keywords: [labelLower, 'create', 'new', 'blocks'],
      inputSchema: BlocksDocumentCreateInput,
      inputDescription: 'Optional title, initial blocks, and select flag.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const {
          title,
          blocks = [],
          select = true,
        } =
          (input as z.infer<typeof BlocksDocumentCreateInput> | undefined) ??
          {};
        const state = getState();
        const previousArtifactId = state.artifacts.config.currentArtifactId;
        const artifactId = state.artifacts.createArtifact({
          type: artifactType,
          title: title ?? defaultTitle,
        });
        state.blocksDocuments.ensureBlocksDocument(artifactId);
        if (blocks.length) {
          state.blocksDocuments.setContent(artifactId, {
            type: 'doc',
            content: blocks.map((block) => blocksDocumentBlockToNode(block)),
          });
        }
        state.artifacts.setCurrentArtifact(
          select ? artifactId : previousArtifactId,
        );
        return {
          success: true,
          commandId: commandId('create'),
          message: `Created ${labelLower} artifact "${artifactId}".`,
          data: readBlocksDocumentData(state, artifactId),
        };
      },
    },
    'append-blocks': {
      id: commandId('append-blocks'),
      name: `Append ${labelLower} blocks`,
      description: `Append top-level blocks to a ${label} artifact`,
      group: commandGroup,
      keywords: [labelLower, 'append', 'blocks'],
      inputSchema: BlocksDocumentBlocksInput,
      inputDescription: `${label} artifact ID and blocks to append.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blocks} = input as z.infer<
          typeof BlocksDocumentBlocksInput
        >;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('append-blocks'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        state.blocksDocuments.appendBlocks(artifactId, blocks);
        return blockMutationSuccess(
          state,
          commandId('append-blocks'),
          artifactId,
          labelLower,
        );
      },
    },
    'insert-blocks': {
      id: commandId('insert-blocks'),
      name: `Insert ${labelLower} blocks`,
      description: `Insert top-level blocks into a ${label} artifact`,
      group: commandGroup,
      keywords: [labelLower, 'insert', 'blocks'],
      inputSchema: BlocksDocumentInsertBlocksInput,
      inputDescription: `${label} artifact ID, insertion index, and blocks.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blocks, index} = input as z.infer<
          typeof BlocksDocumentInsertBlocksInput
        >;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('insert-blocks'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        state.blocksDocuments.insertBlocks(artifactId, index, blocks);
        return blockMutationSuccess(
          state,
          commandId('insert-blocks'),
          artifactId,
          labelLower,
        );
      },
    },
    'update-block': {
      id: commandId('update-block'),
      name: `Update ${labelLower} block`,
      description: `Replace one top-level ${label} block by block ID`,
      group: commandGroup,
      keywords: [labelLower, 'update', 'block'],
      inputSchema: BlocksDocumentUpdateBlockInput,
      inputDescription: `${label} artifact ID, block ID, and replacement block.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId, block} = input as z.infer<
          typeof BlocksDocumentUpdateBlockInput
        >;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('update-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const updated = state.blocksDocuments.updateBlock(
          artifactId,
          blockId,
          block,
        );
        if (!updated) return missingBlock(commandId('update-block'), blockId);
        return blockMutationSuccess(
          state,
          commandId('update-block'),
          artifactId,
          labelLower,
        );
      },
    },
    'remove-block': {
      id: commandId('remove-block'),
      name: `Remove ${labelLower} block`,
      description: `Remove one top-level ${label} block by block ID`,
      group: commandGroup,
      keywords: [labelLower, 'remove', 'delete', 'block'],
      inputSchema: BlocksDocumentBlockIdInput,
      inputDescription: `${label} artifact ID and block ID.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId} = input as z.infer<
          typeof BlocksDocumentBlockIdInput
        >;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('remove-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const removed = state.blocksDocuments.removeBlock(artifactId, blockId);
        if (!removed) return missingBlock(commandId('remove-block'), blockId);
        return blockMutationSuccess(
          state,
          commandId('remove-block'),
          artifactId,
          labelLower,
        );
      },
    },
    'move-block': {
      id: commandId('move-block'),
      name: `Move ${labelLower} block`,
      description: `Move one top-level ${label} block by block ID`,
      group: commandGroup,
      keywords: [labelLower, 'move', 'reorder', 'block'],
      inputSchema: BlocksDocumentMoveBlockInput,
      inputDescription: `${label} artifact ID, block ID, and destination index.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId, toIndex} = input as z.infer<
          typeof BlocksDocumentMoveBlockInput
        >;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('move-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const moved = state.blocksDocuments.moveBlock(
          artifactId,
          blockId,
          toIndex,
        );
        if (!moved) return missingBlock(commandId('move-block'), blockId);
        return blockMutationSuccess(
          state,
          commandId('move-block'),
          artifactId,
          labelLower,
        );
      },
    },
    'create-chart-block': {
      id: commandId('create-chart-block'),
      name: `Create ${labelLower} chart block`,
      description: 'Create a standalone Mosaic/vgplot chart block',
      group: commandGroup,
      keywords: [labelLower, 'chart', 'block', 'vgplot'],
      inputSchema: BlocksDocumentCreateChartBlockInput,
      inputDescription: `${label} artifact ID, tableName, ChartConfig, and optional selection group.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {
          artifactId,
          blockId = createBlocksDocumentBlockId(),
          tableName,
          config,
          selectionGroupId,
          caption,
          index,
        } = input as z.infer<typeof BlocksDocumentCreateChartBlockInput>;
        const resolved = resolveBlocksDocumentArtifact(
          state,
          artifactId,
          commandId('create-chart-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const block = BlocksDocumentChartBlock.parse({
          id: blockId,
          type: 'chart',
          tableName,
          config,
          selectionGroupId,
          caption,
        });
        insertOrAppendBlocks(state, artifactId, [block], index);
        return blockMutationSuccess(
          state,
          commandId('create-chart-block'),
          artifactId,
          labelLower,
          {block},
        );
      },
    },
  } satisfies Record<BlocksDocumentCommandSuffix, RoomCommand<TRoomState>>;

  return BLOCKS_DOCUMENT_COMMAND_SUFFIXES.map(
    (suffix) => commandsBySuffix[suffix],
  );
}

function resolveBlocksDocumentArtifact(
  state: BlocksDocumentCommandState,
  artifactId: string | undefined,
  commandId: string,
  artifactType: string,
  artifactLabel: string,
  artifactLabelLower: string,
) {
  if (!artifactId) {
    return {
      success: false as const,
      commandId,
      error: `No ${artifactLabelLower} artifactId provided and current artifact is not a ${artifactLabelLower}.`,
    };
  }
  const artifact = state.artifacts.getArtifact(artifactId);
  if (!artifact) {
    return {
      success: false as const,
      commandId,
      error: `Unknown artifact "${artifactId}".`,
    };
  }
  if (artifact.type !== artifactType) {
    return {
      success: false as const,
      commandId,
      error: `Artifact "${artifactId}" is not a ${artifactLabel} artifact.`,
    };
  }
  return {success: true as const, artifact};
}

function createBlocksDocumentBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `blocks-document-block-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function insertOrAppendBlocks(
  state: BlocksDocumentCommandState,
  artifactId: string,
  blocks: BlocksDocumentBlockType[],
  index: number | undefined,
) {
  if (typeof index === 'number') {
    state.blocksDocuments.insertBlocks(artifactId, index, blocks);
  } else {
    state.blocksDocuments.appendBlocks(artifactId, blocks);
  }
}

function readBlocksDocumentData(
  state: BlocksDocumentCommandState,
  artifactId: string,
) {
  const artifact = state.artifacts.getArtifact(artifactId);
  const blocksDocument = state.blocksDocuments.getBlocksDocument(artifactId);
  const content = BlocksDocumentContent.parse(
    blocksDocument?.content ?? createEmptyBlocksDocumentContent(),
  );
  return {
    artifactId,
    title: artifact?.title,
    blocks: state.blocksDocuments.getBlocks(artifactId),
    content,
    assets: Object.values(blocksDocument?.assets ?? {}).map(
      blocksDocumentAssetMetadata,
    ),
    updatedAt: blocksDocument?.updatedAt,
  };
}

function blockMutationSuccess(
  state: BlocksDocumentCommandState,
  commandId: string,
  artifactId: string,
  artifactLabelLower: string,
  extraData: Record<string, unknown> = {},
) {
  return {
    success: true,
    commandId,
    message: `Updated ${artifactLabelLower} artifact "${artifactId}".`,
    data: {
      ...readBlocksDocumentData(state, artifactId),
      ...extraData,
    },
  };
}

function missingBlock(commandId: string, blockId: string) {
  return {
    success: false as const,
    commandId,
    error: `Unknown block "${blockId}".`,
  };
}

function blocksDocumentAssetMetadata(asset: {
  id: string;
  filename?: string;
  mediaType: string;
  encoding: string;
  alt?: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: asset.id,
    filename: asset.filename,
    mediaType: asset.mediaType,
    encoding: asset.encoding,
    alt: asset.alt,
    title: asset.title,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}
