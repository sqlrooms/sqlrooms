import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {
  AnalysisBlock,
  AnalysisChartBlock,
  AnalysisDocumentContent,
  analysisBlockToNode,
  createEmptyAnalysisDocumentContent,
  type AnalysisBlock as AnalysisBlockType,
} from './AnalysisDocumentSliceConfig';
import type {AnalysisDocumentsSliceState} from './AnalysisDocumentsSlice';

export const ANALYSIS_AI_INSTRUCTIONS = `
Analysis artifacts:
- Use analysis.list and analysis.get to inspect block-composed analysis documents.
- Use analysis.create to create a new analysis artifact.
- Use analysis.append-blocks, analysis.insert-blocks, analysis.update-block, analysis.remove-block, and analysis.move-block for deterministic block edits.
- Use analysis.create-chart-block for standalone Mosaic/vgplot chart blocks.
- Use analysis.embed-dashboard to embed an existing dashboard or create a new embedded dashboard artifact block.
`.trim();

type AnalysisCommandState = BaseRoomStoreState & {
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
} & AnalysisDocumentsSliceState;

const AnalysisIdInput = z
  .object({
    artifactId: z.string().optional().describe('Target analysis artifact ID.'),
  })
  .default({});

const AnalysisCreateInput = z
  .object({
    title: z.string().optional().describe('Optional analysis title.'),
    blocks: z
      .array(AnalysisBlock)
      .optional()
      .describe('Initial top-level blocks.'),
    select: z
      .boolean()
      .optional()
      .describe('Whether to select the new analysis artifact.'),
  })
  .default({});

const AnalysisBlocksInput = z.object({
  artifactId: z.string().describe('Target analysis artifact ID.'),
  blocks: z.array(AnalysisBlock).describe('Blocks to add.'),
});

const AnalysisInsertBlocksInput = AnalysisBlocksInput.extend({
  index: z.number().int().describe('Top-level insertion index.'),
});

const AnalysisUpdateBlockInput = z.object({
  artifactId: z.string().describe('Target analysis artifact ID.'),
  blockId: z.string().describe('Block ID to update.'),
  block: AnalysisBlock.describe('Replacement block. Its id is ignored.'),
});

const AnalysisBlockIdInput = z.object({
  artifactId: z.string().describe('Target analysis artifact ID.'),
  blockId: z.string().describe('Target block ID.'),
});

const AnalysisMoveBlockInput = AnalysisBlockIdInput.extend({
  toIndex: z.number().int().describe('Destination top-level block index.'),
});

const AnalysisCreateChartBlockInput = z.object({
  artifactId: z.string().describe('Target analysis artifact ID.'),
  blockId: z.string().optional().describe('Optional explicit chart block ID.'),
  tableName: z.string().describe('Mosaic table name to render.'),
  config: z.unknown().describe('Mosaic ChartConfig payload.'),
  selectionGroupId: z
    .string()
    .optional()
    .describe('Optional crossfilter group for linked analysis charts.'),
  caption: z.string().optional().describe('Optional chart caption.'),
  index: z
    .number()
    .int()
    .optional()
    .describe('Optional top-level insertion index. Defaults to append.'),
});

const AnalysisEmbedDashboardInput = z.object({
  artifactId: z.string().describe('Target analysis artifact ID.'),
  blockId: z.string().optional().describe('Optional explicit embed block ID.'),
  dashboardArtifactId: z
    .string()
    .optional()
    .describe('Existing dashboard artifact to embed.'),
  dashboardTitle: z
    .string()
    .optional()
    .describe('Title for a newly-created embedded dashboard.'),
  caption: z.string().optional().describe('Optional embed caption.'),
  index: z
    .number()
    .int()
    .optional()
    .describe('Optional top-level insertion index. Defaults to append.'),
});

export function createAnalysisCommands<
  TRoomState extends AnalysisCommandState = AnalysisCommandState,
>(): RoomCommand<TRoomState>[] {
  return [
    {
      id: 'analysis.list',
      name: 'List analyses',
      description: 'List Analysis artifacts in the room',
      group: 'Analysis',
      keywords: ['analysis', 'document', 'blocks', 'list'],
      metadata: {readOnly: true, idempotent: true, riskLevel: 'low'},
      execute: ({getState}) => {
        const state = getState();
        const analyses = Object.values(state.artifacts.config.artifactsById)
          .filter((artifact) => artifact.type === 'analysis')
          .map((artifact) => {
            const analysis = state.analysisDocuments.getAnalysis(artifact.id);
            return {
              artifactId: artifact.id,
              title: artifact.title,
              updatedAt: analysis?.updatedAt,
              blockCount: analysis?.content.content.length ?? 0,
              assetCount: Object.keys(analysis?.assets ?? {}).length,
            };
          });
        return {success: true, commandId: 'analysis.list', data: {analyses}};
      },
    },
    {
      id: 'analysis.get',
      name: 'Get analysis',
      description:
        'Read blocks from an Analysis artifact. Defaults to the current analysis artifact.',
      group: 'Analysis',
      keywords: ['analysis', 'read', 'get', 'blocks'],
      inputSchema: AnalysisIdInput,
      inputDescription:
        'Optional analysis artifact ID. Defaults to the current analysis.',
      metadata: {readOnly: true, idempotent: true, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId: requestedArtifactId} =
          (input as z.infer<typeof AnalysisIdInput> | undefined) ?? {};
        const artifactId =
          requestedArtifactId ?? state.artifacts.config.currentArtifactId;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.get',
        );
        if (!resolved.success) return resolved;
        const analysis = state.analysisDocuments.getAnalysis(
          resolved.artifact.id,
        );
        return {
          success: true,
          commandId: 'analysis.get',
          data: {
            artifactId: resolved.artifact.id,
            title: resolved.artifact.title,
            blocks: state.analysisDocuments.getBlocks(resolved.artifact.id),
            content: analysis?.content ?? createEmptyAnalysisDocumentContent(),
            assets: Object.values(analysis?.assets ?? {}).map(
              analysisAssetMetadata,
            ),
            updatedAt: analysis?.updatedAt,
          },
        };
      },
    },
    {
      id: 'analysis.create',
      name: 'Create analysis',
      description: 'Create an Analysis artifact with optional initial blocks',
      group: 'Analysis',
      keywords: ['analysis', 'create', 'new', 'blocks'],
      inputSchema: AnalysisCreateInput,
      inputDescription: 'Optional title, initial blocks, and select flag.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'low'},
      execute: ({getState}, input) => {
        const {
          title,
          blocks = [],
          select = true,
        } = (input as z.infer<typeof AnalysisCreateInput> | undefined) ?? {};
        const state = getState();
        const previousArtifactId = state.artifacts.config.currentArtifactId;
        const artifactId = state.artifacts.createArtifact({
          type: 'analysis',
          title: title ?? 'Analysis',
        });
        state.analysisDocuments.ensureAnalysis(artifactId);
        if (blocks.length) {
          state.analysisDocuments.setContent(artifactId, {
            type: 'doc',
            content: blocks.map((block) => analysisBlockToNode(block)),
          });
        }
        if (select) {
          state.artifacts.setCurrentArtifact(artifactId);
        } else {
          state.artifacts.setCurrentArtifact(previousArtifactId);
        }
        return {
          success: true,
          commandId: 'analysis.create',
          message: `Created analysis artifact "${artifactId}".`,
          data: readAnalysisData(state, artifactId),
        };
      },
    },
    {
      id: 'analysis.append-blocks',
      name: 'Append analysis blocks',
      description: 'Append top-level blocks to an Analysis artifact',
      group: 'Analysis',
      keywords: ['analysis', 'append', 'blocks'],
      inputSchema: AnalysisBlocksInput,
      inputDescription: 'Analysis artifact ID and blocks to append.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blocks} = input as z.infer<
          typeof AnalysisBlocksInput
        >;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.append-blocks',
        );
        if (!resolved.success) return resolved;
        state.analysisDocuments.appendBlocks(artifactId, blocks);
        return blockMutationSuccess(
          state,
          'analysis.append-blocks',
          artifactId,
        );
      },
    },
    {
      id: 'analysis.insert-blocks',
      name: 'Insert analysis blocks',
      description: 'Insert top-level blocks into an Analysis artifact',
      group: 'Analysis',
      keywords: ['analysis', 'insert', 'blocks'],
      inputSchema: AnalysisInsertBlocksInput,
      inputDescription: 'Analysis artifact ID, insertion index, and blocks.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blocks, index} = input as z.infer<
          typeof AnalysisInsertBlocksInput
        >;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.insert-blocks',
        );
        if (!resolved.success) return resolved;
        state.analysisDocuments.insertBlocks(artifactId, index, blocks);
        return blockMutationSuccess(
          state,
          'analysis.insert-blocks',
          artifactId,
        );
      },
    },
    {
      id: 'analysis.update-block',
      name: 'Update analysis block',
      description: 'Replace one top-level Analysis block by block ID',
      group: 'Analysis',
      keywords: ['analysis', 'update', 'block'],
      inputSchema: AnalysisUpdateBlockInput,
      inputDescription:
        'Analysis artifact ID, block ID, and replacement block.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId, block} = input as z.infer<
          typeof AnalysisUpdateBlockInput
        >;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.update-block',
        );
        if (!resolved.success) return resolved;
        const updated = state.analysisDocuments.updateBlock(
          artifactId,
          blockId,
          block,
        );
        if (!updated) return missingBlock('analysis.update-block', blockId);
        return blockMutationSuccess(state, 'analysis.update-block', artifactId);
      },
    },
    {
      id: 'analysis.remove-block',
      name: 'Remove analysis block',
      description: 'Remove one top-level Analysis block by block ID',
      group: 'Analysis',
      keywords: ['analysis', 'remove', 'delete', 'block'],
      inputSchema: AnalysisBlockIdInput,
      inputDescription: 'Analysis artifact ID and block ID.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId} = input as z.infer<
          typeof AnalysisBlockIdInput
        >;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.remove-block',
        );
        if (!resolved.success) return resolved;
        const removed = state.analysisDocuments.removeBlock(
          artifactId,
          blockId,
        );
        if (!removed) return missingBlock('analysis.remove-block', blockId);
        return blockMutationSuccess(state, 'analysis.remove-block', artifactId);
      },
    },
    {
      id: 'analysis.move-block',
      name: 'Move analysis block',
      description: 'Move one top-level Analysis block by block ID',
      group: 'Analysis',
      keywords: ['analysis', 'move', 'reorder', 'block'],
      inputSchema: AnalysisMoveBlockInput,
      inputDescription:
        'Analysis artifact ID, block ID, and destination index.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {artifactId, blockId, toIndex} = input as z.infer<
          typeof AnalysisMoveBlockInput
        >;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.move-block',
        );
        if (!resolved.success) return resolved;
        const moved = state.analysisDocuments.moveBlock(
          artifactId,
          blockId,
          toIndex,
        );
        if (!moved) return missingBlock('analysis.move-block', blockId);
        return blockMutationSuccess(state, 'analysis.move-block', artifactId);
      },
    },
    {
      id: 'analysis.create-chart-block',
      name: 'Create analysis chart block',
      description: 'Create a standalone Mosaic/vgplot chart block',
      group: 'Analysis',
      keywords: ['analysis', 'chart', 'block', 'vgplot'],
      inputSchema: AnalysisCreateChartBlockInput,
      inputDescription:
        'Analysis artifact ID, tableName, ChartConfig, and optional selection group.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {
          artifactId,
          blockId = createAnalysisBlockId(),
          tableName,
          config,
          selectionGroupId,
          caption,
          index,
        } = input as z.infer<typeof AnalysisCreateChartBlockInput>;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.create-chart-block',
        );
        if (!resolved.success) return resolved;
        const block = AnalysisChartBlock.parse({
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
          'analysis.create-chart-block',
          artifactId,
          {block},
        );
      },
    },
    {
      id: 'analysis.embed-dashboard',
      name: 'Embed dashboard in analysis',
      description:
        'Embed an existing dashboard artifact or create a new embedded dashboard block',
      group: 'Analysis',
      keywords: ['analysis', 'dashboard', 'embed', 'block'],
      inputSchema: AnalysisEmbedDashboardInput,
      inputDescription:
        'Analysis artifact ID plus existing dashboardArtifactId or dashboardTitle.',
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const state = getState();
        const {
          artifactId,
          blockId = createAnalysisBlockId(),
          dashboardArtifactId,
          dashboardTitle = 'Embedded Dashboard',
          caption,
          index,
        } = input as z.infer<typeof AnalysisEmbedDashboardInput>;
        const resolved = resolveAnalysisArtifact(
          state,
          artifactId,
          'analysis.embed-dashboard',
        );
        if (!resolved.success) return resolved;
        const embeddedDashboardId =
          dashboardArtifactId ??
          state.artifacts.createArtifact({
            type: 'dashboard',
            title: dashboardTitle,
            visibility: 'embedded',
            parentArtifactId: artifactId,
          });
        const dashboardArtifact =
          state.artifacts.getArtifact(embeddedDashboardId);
        if (!dashboardArtifact) {
          return {
            success: false,
            commandId: 'analysis.embed-dashboard',
            error: `Unknown dashboard artifact "${embeddedDashboardId}".`,
          };
        }
        if (dashboardArtifact.type !== 'dashboard') {
          return {
            success: false,
            commandId: 'analysis.embed-dashboard',
            error: `Artifact "${embeddedDashboardId}" is not a dashboard artifact.`,
          };
        }
        const block: AnalysisBlockType = {
          id: blockId,
          type: 'artifactEmbed',
          artifactId: embeddedDashboardId,
          artifactType: 'dashboard',
          caption,
        };
        insertOrAppendBlocks(state, artifactId, [block], index);
        return blockMutationSuccess(
          state,
          'analysis.embed-dashboard',
          artifactId,
          {block, dashboardArtifactId: embeddedDashboardId},
        );
      },
    },
  ];
}

function resolveAnalysisArtifact(
  state: AnalysisCommandState,
  artifactId: string | undefined,
  commandId: string,
) {
  if (!artifactId) {
    return {
      success: false as const,
      commandId,
      error:
        'No analysis artifactId provided and current artifact is not an analysis.',
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
  if (artifact.type !== 'analysis') {
    return {
      success: false as const,
      commandId,
      error: `Artifact "${artifactId}" is not an analysis artifact.`,
    };
  }
  return {success: true as const, artifact};
}

function createAnalysisBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `analysis-block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function insertOrAppendBlocks(
  state: AnalysisCommandState,
  artifactId: string,
  blocks: AnalysisBlockType[],
  index: number | undefined,
) {
  if (typeof index === 'number') {
    state.analysisDocuments.insertBlocks(artifactId, index, blocks);
  } else {
    state.analysisDocuments.appendBlocks(artifactId, blocks);
  }
}

function readAnalysisData(state: AnalysisCommandState, artifactId: string) {
  const artifact = state.artifacts.getArtifact(artifactId);
  const analysis = state.analysisDocuments.getAnalysis(artifactId);
  const content = AnalysisDocumentContent.parse(
    analysis?.content ?? createEmptyAnalysisDocumentContent(),
  );
  return {
    artifactId,
    title: artifact?.title,
    blocks: state.analysisDocuments.getBlocks(artifactId),
    content,
    assets: Object.values(analysis?.assets ?? {}).map(analysisAssetMetadata),
    updatedAt: analysis?.updatedAt,
  };
}

function blockMutationSuccess(
  state: AnalysisCommandState,
  commandId: string,
  artifactId: string,
  extraData: Record<string, unknown> = {},
) {
  return {
    success: true,
    commandId,
    message: `Updated analysis artifact "${artifactId}".`,
    data: {
      ...readAnalysisData(state, artifactId),
      ...extraData,
    },
  };
}

function missingBlock(commandId: string, blockId: string) {
  return {
    success: false as const,
    commandId,
    error: `Unknown analysis block "${blockId}".`,
  };
}

function analysisAssetMetadata(asset: {
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
