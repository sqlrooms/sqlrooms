import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {
  BlockDocumentBlock,
  BlockDocumentChartBlock,
  BlockDocumentStatefulBlockBlock,
  BlockDocumentContent,
  blockDocumentBlockToNode,
  createEmptyBlockDocumentContent,
  type BlockDocumentBlock as BlockDocumentBlockType,
} from './BlockDocumentSliceConfig';
import type {BlockDocumentsSliceState} from './BlockDocumentsSlice';

export const BLOCK_DOCUMENT_COMMAND_SUFFIXES = [
  'list',
  'get',
  'create',
  'append-blocks',
  'insert-blocks',
  'update-block',
  'remove-block',
  'move-block',
  'create-chart-block',
  'create-stateful-block',
] as const;

export type BlockDocumentCommandSuffix =
  (typeof BLOCK_DOCUMENT_COMMAND_SUFFIXES)[number];

export type BlockDocumentStatefulBlockCommandContext<TRoomState> = {
  state: TRoomState;
  artifactId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership: 'owned' | 'shared' | 'external';
  title: string;
  caption?: string;
};

export type BlockDocumentStatefulBlockCommandType<TRoomState> = {
  blockType: string;
  label?: string;
  description?: string;
  defaultTitle?: string;
  defaultHeight?: number;
  ensureState?: (
    context: BlockDocumentStatefulBlockCommandContext<TRoomState>,
  ) => void;
};

export type CreateBlockDocumentCommandsOptions<
  TRoomState extends BlockDocumentCommandState = BlockDocumentCommandState,
> = {
  artifactType?: string;
  artifactLabel?: string;
  commandNamespace?: string;
  commandGroup?: string;
  defaultTitle?: string;
  statefulBlockTypes?: BlockDocumentStatefulBlockCommandType<TRoomState>[];
};

type BlockDocumentCommandState = BaseRoomStoreState & {
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
} & BlockDocumentsSliceState;

const BlockDocumentIdInput = z
  .object({
    artifactId: z
      .string()
      .optional()
      .describe('Target block document artifact ID.'),
  })
  .default({});

const BlockDocumentCreateInput = z
  .object({
    title: z.string().optional().describe('Optional artifact title.'),
    blocks: z
      .array(BlockDocumentBlock)
      .optional()
      .describe('Initial top-level blocks.'),
    select: z
      .boolean()
      .optional()
      .describe('Whether to select the new artifact.'),
  })
  .default({});

const BlockDocumentBlocksInput = z.object({
  artifactId: z.string().describe('Target block document artifact ID.'),
  blocks: z.array(BlockDocumentBlock).describe('Blocks to add.'),
});

const BlockDocumentInsertBlocksInput = BlockDocumentBlocksInput.extend({
  index: z.number().int().describe('Top-level insertion index.'),
});

const BlockDocumentUpdateBlockInput = z.object({
  artifactId: z.string().describe('Target block document artifact ID.'),
  blockId: z.string().describe('Block ID to update.'),
  block: BlockDocumentBlock.describe('Replacement block. Its id is ignored.'),
});

const BlockDocumentBlockIdInput = z.object({
  artifactId: z.string().describe('Target block document artifact ID.'),
  blockId: z.string().describe('Target block ID.'),
});

const BlockDocumentMoveBlockInput = BlockDocumentBlockIdInput.extend({
  toIndex: z.number().int().describe('Destination top-level block index.'),
});

const BlockDocumentCreateChartBlockInput = z.object({
  artifactId: z.string().describe('Target block document artifact ID.'),
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

const BlockDocumentCreateStatefulBlockInput = z.object({
  artifactId: z.string().describe('Target block document artifact ID.'),
  blockType: z
    .string()
    .describe('Stateful block type to create, for example dashboard or pivot.'),
  blockId: z
    .string()
    .optional()
    .describe('Optional explicit document block ID.'),
  blockInstanceId: z
    .string()
    .optional()
    .describe(
      'Optional explicit backing state instance ID. Defaults to blockId.',
    ),
  ownership: z
    .enum(['owned', 'shared', 'external'])
    .optional()
    .describe('State ownership mode. Defaults to owned.'),
  title: z.string().optional().describe('Optional stateful block title.'),
  caption: z.string().optional().describe('Optional document-local caption.'),
  height: z
    .number()
    .positive()
    .optional()
    .describe('Optional persisted block height in pixels.'),
  index: z
    .number()
    .int()
    .optional()
    .describe('Optional top-level insertion index. Defaults to append.'),
});

function lowerLabel(label: string) {
  return label.toLocaleLowerCase();
}

function labelFromBlockType(blockType: string) {
  return blockType
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function createBlockDocumentCommandIds(
  commandNamespace = 'block-document',
) {
  return BLOCK_DOCUMENT_COMMAND_SUFFIXES.map(
    (suffix) => `${commandNamespace}.${suffix}`,
  );
}

export function createBlockDocumentCommands<
  TRoomState extends BlockDocumentCommandState = BlockDocumentCommandState,
>({
  artifactType = 'block-document',
  artifactLabel = 'Block Document',
  commandNamespace = 'block-document',
  commandGroup = artifactLabel,
  defaultTitle = artifactLabel,
  statefulBlockTypes = [],
}: CreateBlockDocumentCommandsOptions<TRoomState> = {}): RoomCommand<TRoomState>[] {
  const label = artifactLabel;
  const labelLower = lowerLabel(label);
  const commandId = (suffix: BlockDocumentCommandSuffix) =>
    `${commandNamespace}.${suffix}`;
  const statefulBlockTypesByType = new Map(
    statefulBlockTypes.map((blockType) => [blockType.blockType, blockType]),
  );

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
            const blockDocument = state.blockDocuments.getBlockDocument(
              artifact.id,
            );
            return {
              artifactId: artifact.id,
              title: artifact.title,
              updatedAt: blockDocument?.updatedAt,
              blockCount: blockDocument?.content.content.length ?? 0,
              assetCount: Object.keys(blockDocument?.assets ?? {}).length,
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
      inputSchema: BlockDocumentIdInput,
      inputDescription: `Optional ${labelLower} artifact ID. Defaults to the current ${labelLower}.`,
      metadata: {readOnly: true, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId: requestedArtifactId} =
          (input as z.infer<typeof BlockDocumentIdInput> | undefined) ?? {};
        const artifactId =
          requestedArtifactId ?? state.artifacts.config.currentArtifactId;
        const resolved = resolveBlockDocumentArtifact(
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
          data: readBlockDocumentData(state, resolved.artifact.id),
        };
      },
    },
    create: {
      id: commandId('create'),
      name: `Create ${labelLower}`,
      description: `Create a ${label} artifact with optional initial blocks`,
      group: commandGroup,
      keywords: [labelLower, 'create', 'new', 'blocks'],
      inputSchema: BlockDocumentCreateInput,
      inputDescription: 'Optional title, initial blocks, and select flag.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const {
          title,
          blocks = [],
          select = true,
        } = (input as z.infer<typeof BlockDocumentCreateInput> | undefined) ??
        {};
        const state = getState();
        const previousArtifactId = state.artifacts.config.currentArtifactId;
        const artifactId = state.artifacts.createArtifact({
          type: artifactType,
          title: title ?? defaultTitle,
        });
        state.blockDocuments.ensureBlockDocument(artifactId);
        if (blocks.length) {
          state.blockDocuments.setContent(artifactId, {
            type: 'doc',
            content: blocks.map((block) => blockDocumentBlockToNode(block)),
          });
        }
        state.artifacts.setCurrentArtifact(
          select ? artifactId : previousArtifactId,
        );
        return {
          success: true,
          commandId: commandId('create'),
          message: `Created ${labelLower} artifact "${artifactId}".`,
          data: readBlockDocumentData(state, artifactId),
        };
      },
    },
    'append-blocks': {
      id: commandId('append-blocks'),
      name: `Append ${labelLower} blocks`,
      description: `Append top-level blocks to a ${label} artifact`,
      group: commandGroup,
      keywords: [labelLower, 'append', 'blocks'],
      inputSchema: BlockDocumentBlocksInput,
      inputDescription: `${label} artifact ID and blocks to append.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blocks} = input as z.infer<
          typeof BlockDocumentBlocksInput
        >;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('append-blocks'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        state.blockDocuments.appendBlocks(artifactId, blocks);
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
      inputSchema: BlockDocumentInsertBlocksInput,
      inputDescription: `${label} artifact ID, insertion index, and blocks.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blocks, index} = input as z.infer<
          typeof BlockDocumentInsertBlocksInput
        >;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('insert-blocks'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        state.blockDocuments.insertBlocks(artifactId, index, blocks);
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
      inputSchema: BlockDocumentUpdateBlockInput,
      inputDescription: `${label} artifact ID, block ID, and replacement block.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId, block} = input as z.infer<
          typeof BlockDocumentUpdateBlockInput
        >;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('update-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const updated = state.blockDocuments.updateBlock(
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
      inputSchema: BlockDocumentBlockIdInput,
      inputDescription: `${label} artifact ID and block ID.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId} = input as z.infer<
          typeof BlockDocumentBlockIdInput
        >;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('remove-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const removed = state.blockDocuments.removeBlock(artifactId, blockId);
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
      inputSchema: BlockDocumentMoveBlockInput,
      inputDescription: `${label} artifact ID, block ID, and destination index.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId, toIndex} = input as z.infer<
          typeof BlockDocumentMoveBlockInput
        >;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('move-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const moved = state.blockDocuments.moveBlock(
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
      inputSchema: BlockDocumentCreateChartBlockInput,
      inputDescription: `${label} artifact ID, tableName, ChartConfig, and optional selection group.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {
          artifactId,
          blockId = createBlockDocumentBlockId(),
          tableName,
          config,
          selectionGroupId,
          caption,
          index,
        } = input as z.infer<typeof BlockDocumentCreateChartBlockInput>;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('create-chart-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;
        const block = BlockDocumentChartBlock.parse({
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
    'create-stateful-block': {
      id: commandId('create-stateful-block'),
      name: `Create ${labelLower} stateful block`,
      description:
        'Create a hosted stateful block such as a dashboard, pivot table, or document block',
      group: commandGroup,
      keywords: [labelLower, 'stateful', 'block', 'dashboard', 'pivot'],
      inputSchema: BlockDocumentCreateStatefulBlockInput,
      inputDescription: `${label} artifact ID, blockType, and optional title/caption/index.`,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {
          artifactId,
          blockType,
          blockId = createBlockDocumentBlockId(),
          ownership = 'owned',
          title,
          caption,
          height,
          index,
        } = input as z.infer<typeof BlockDocumentCreateStatefulBlockInput>;
        const resolved = resolveBlockDocumentArtifact(
          state,
          artifactId,
          commandId('create-stateful-block'),
          artifactType,
          label,
          labelLower,
        );
        if (!resolved.success) return resolved;

        const blockConfig = statefulBlockTypesByType.get(blockType);
        if (statefulBlockTypes.length > 0 && !blockConfig) {
          return {
            success: false,
            commandId: commandId('create-stateful-block'),
            error: `Unsupported stateful block type "${blockType}".`,
          };
        }

        const blockInstanceId =
          (input as z.infer<typeof BlockDocumentCreateStatefulBlockInput>)
            .blockInstanceId ?? blockId;
        const blockTitle =
          title ??
          blockConfig?.defaultTitle ??
          blockConfig?.label ??
          labelFromBlockType(blockType);

        if (ownership === 'owned') {
          blockConfig?.ensureState?.({
            state,
            artifactId,
            blockId,
            blockType,
            blockInstanceId,
            ownership,
            title: blockTitle,
            caption,
          });
        }

        const block = BlockDocumentStatefulBlockBlock.parse({
          id: blockId,
          type: 'statefulBlock',
          blockType,
          blockInstanceId,
          ownership,
          title: blockTitle,
          caption,
          height: height ?? blockConfig?.defaultHeight,
        });
        insertOrAppendBlocks(state, artifactId, [block], index);
        return blockMutationSuccess(
          state,
          commandId('create-stateful-block'),
          artifactId,
          labelLower,
          {block},
        );
      },
    },
  } satisfies Record<BlockDocumentCommandSuffix, RoomCommand<TRoomState>>;

  return BLOCK_DOCUMENT_COMMAND_SUFFIXES.map(
    (suffix) => commandsBySuffix[suffix],
  );
}

function resolveBlockDocumentArtifact(
  state: BlockDocumentCommandState,
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

function createBlockDocumentBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `block-document-block-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function insertOrAppendBlocks(
  state: BlockDocumentCommandState,
  artifactId: string,
  blocks: BlockDocumentBlockType[],
  index: number | undefined,
) {
  if (typeof index === 'number') {
    state.blockDocuments.insertBlocks(artifactId, index, blocks);
  } else {
    state.blockDocuments.appendBlocks(artifactId, blocks);
  }
}

function readBlockDocumentData(
  state: BlockDocumentCommandState,
  artifactId: string,
) {
  const artifact = state.artifacts.getArtifact(artifactId);
  const blockDocument = state.blockDocuments.getBlockDocument(artifactId);
  const content = BlockDocumentContent.parse(
    blockDocument?.content ?? createEmptyBlockDocumentContent(),
  );
  return {
    artifactId,
    title: artifact?.title,
    blocks: state.blockDocuments.getBlocks(artifactId),
    content,
    assets: Object.values(blockDocument?.assets ?? {}).map(
      blockDocumentAssetMetadata,
    ),
    updatedAt: blockDocument?.updatedAt,
  };
}

function blockMutationSuccess(
  state: BlockDocumentCommandState,
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
      ...readBlockDocumentData(state, artifactId),
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

function blockDocumentAssetMetadata(asset: {
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
