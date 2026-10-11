import {ArtifactsSliceConfig} from '@sqlrooms/artifacts';
import {HtmlAppRuntimeConfig} from '@sqlrooms/app-runtime';
import {
  BlockDocumentsSliceConfig,
  blockDocumentContentToBlocks,
  blockDocumentNodeToBlock,
  type BlockDocumentNode,
  type BlockDocumentBlock,
} from '@sqlrooms/documents';
import {ChartConfig, MosaicDashboardSliceConfig} from '@sqlrooms/mosaic';
import {z} from 'zod';

import {ROOMIE_CAPABILITIES, STATEFUL_BLOCKS} from './capabilities';
export {
  ROOMIE_CAPABILITIES,
  STATEFUL_BLOCKS,
  EDITORIAL_BLOCKS,
} from './capabilities';

/** Persisted table explorer preferences, scoped to one document block. */
export const TableSettings = z.object({
  filters: z
    .array(z.string().max(16000))
    .max(100)
    .default([])
    .describe(
      'Mosaic-generated SQL filter predicates; use an empty array to clear saved filters.',
    ),
  columns: z.array(z.string()).optional(),
  sorting: z.array(z.object({id: z.string(), desc: z.boolean()})).default([]),
  pageSize: z.number().int().min(1).max(1000).default(25),
});
export const TableExplorersConfig = z.object({
  byId: z.record(z.string(), TableSettings).default({}),
});
export const sliceSchemas = {
  artifacts: ArtifactsSliceConfig,
  blockDocuments: BlockDocumentsSliceConfig,
  mosaicDashboard: MosaicDashboardSliceConfig,
  htmlApps: HtmlAppRuntimeConfig,
  tableExplorers: TableExplorersConfig,
};

/** Reject unsupported chart types before a command or save mutates state. */
export function validateChart(value: unknown) {
  const config = ChartConfig.parse(value);
  if (
    !(ROOMIE_CAPABILITIES.chartTypes as readonly string[]).includes(
      config.chartType,
    )
  )
    throw new Error(`Unsupported Roomie chart type: ${config.chartType}`);
  return config;
}

/** Validate portable document blocks independently of their renderer. */
export function validateBlock(block: BlockDocumentBlock) {
  if (block.type === 'chart') validateChart(block.config);
  if (block.type === 'statefulBlock') {
    if (!(STATEFUL_BLOCKS as readonly string[]).includes(block.blockType))
      throw new Error(`Unsupported Roomie block: ${block.blockType}`);
    if (block.ownership && block.ownership !== 'owned')
      throw new Error('Roomie blocks must be owned by their document.');
  }
}

/** Reject nodes or marks the editor would otherwise silently discard. */
export function validateDocumentNode(node: BlockDocumentNode) {
  const nodes = [
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'taskList',
    'taskItem',
    'text',
    'hardBreak',
    'horizontalRule',
    'blockquote',
    'codeBlock',
    'blockDocumentImage',
    'blockDocumentChartImage',
    'blockDocumentChart',
    'blockDocumentStatefulBlock',
  ];
  if (!nodes.includes(node.type))
    throw new Error(`Unsupported document node: ${node.type}`);
  for (const mark of node.marks ?? [])
    if (
      !['bold', 'italic', 'strike', 'code', 'link', 'underline'].includes(
        mark.type,
      )
    )
      throw new Error(`Unsupported document mark: ${mark.type}`);
  if (node.type.startsWith('blockDocument')) {
    const block = blockDocumentNodeToBlock(node);
    if (!block) throw new Error('Malformed analytical document block.');
    validateBlock(block);
  }
  for (const child of node.content ?? []) validateDocumentNode(child);
}

/** Versioned envelope; foreign or unsupported content fails without enabling saves. */
export const Workspace = z
  .strictObject({
    application: z.literal('roomie'),
    schemaVersion: z.literal(1),
    ...sliceSchemas,
  })
  .superRefine((value, context) => {
    try {
      const instances = new Set<string>();
      for (const artifact of Object.values(value.artifacts.artifactsById)) {
        if (artifact.type !== 'block-document')
          throw new Error('Only Document artifacts are supported.');
        if (!value.blockDocuments.artifacts[artifact.id])
          throw new Error('Missing document content.');
      }
      for (const document of Object.values(value.blockDocuments.artifacts)) {
        if (!value.artifacts.artifactsById[document.id])
          throw new Error('Orphan document content.');
        for (const node of document.content.content) validateDocumentNode(node);
        for (const block of blockDocumentContentToBlocks(document.content)) {
          validateBlock(block);
          if (block.type !== 'statefulBlock') continue;
          if (instances.has(block.blockInstanceId))
            throw new Error(
              'Block instances cannot be shared across documents.',
            );
          instances.add(block.blockInstanceId);
          const backing =
            block.blockType === 'dashboard'
              ? value.mosaicDashboard.dashboardsById
              : block.blockType === 'html-app'
                ? value.htmlApps.appsById
                : value.tableExplorers.byId;
          if (!backing[block.blockInstanceId])
            throw new Error('Missing document block state.');
        }
      }
      for (const dashboard of Object.values(
        value.mosaicDashboard.dashboardsById,
      )) {
        for (const panel of dashboard.panels) {
          if (
            !(
              ROOMIE_CAPABILITIES.dashboardPanels as readonly string[]
            ).includes(panel.type)
          )
            throw new Error(`Unsupported dashboard panel: ${panel.type}`);
          if (panel.type === 'vgplot') validateChart(panel.config);
        }
      }
    } catch (error) {
      context.addIssue({code: 'custom', message: String(error)});
    }
  });
