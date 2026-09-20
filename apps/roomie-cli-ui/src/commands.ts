import {
  createBlockDocumentCommands,
  blockDocumentContentToBlocks,
  type BlockDocumentBlock,
  type BlockDocumentStatefulBlockCommandType,
} from '@sqlrooms/documents';
import {createMosaicDashboardCommands} from '@sqlrooms/mosaic';
import {createHtmlAppRevisionCommands} from '@sqlrooms/app-runtime';
import {
  createLocalDataCommands,
  type LocalFileResolver,
} from '@sqlrooms/mcp/room';
import type {RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';
import {
  STATEFUL_BLOCKS,
  EDITORIAL_BLOCKS,
  ROOMIE_CAPABILITIES,
  TableSettings,
  validateBlock,
  validateChart,
  validateDocumentNode,
} from './model';
import type {RoomState} from './RoomState';
import {validateTableFilters} from './tableSelection';
import {
  validateBlockRenderSources,
  validateRenderSource,
} from './renderSources';

/** Initialize only block-scoped backing state; it never creates extra artifacts. */
export function ensureBlock(
  state: RoomState,
  blockType: string,
  id: string,
  title?: string,
) {
  if (blockType === 'dashboard')
    state.mosaicDashboard.ensureDashboard(id, title, 'grid');
  else if (blockType === 'html-app' && !state.htmlApps.getApp(id))
    state.htmlApps.ensureApp(id, {title});
  else if (blockType === 'data-table' && !state.tableExplorers.config.byId[id])
    state.tableExplorers.update(id, TableSettings.parse({}));
}

function ownedBlocks(state: RoomState) {
  return Object.values(state.blockDocuments.config.artifacts).flatMap(
    (document) => blockDocumentContentToBlocks(document.content),
  );
}

/** Commands are the authoring API used by menus and external MCP clients. */
export function createRoomieCommands(options: {
  resolveLocalFile: LocalFileResolver;
}): RoomCommand<RoomState>[] {
  const blockTypes: BlockDocumentStatefulBlockCommandType<RoomState>[] =
    STATEFUL_BLOCKS.map((blockType) => ({
      blockType,
      label:
        blockType === 'data-table'
          ? 'Data table'
          : blockType === 'html-app'
            ? 'HTML app'
            : 'Dashboard',
      defaultHeight: 520,
      ensureState: ({state, blockInstanceId, title}) =>
        ensureBlock(state, blockType, blockInstanceId, title),
      readState: ({state, blockInstanceId}) =>
        blockType === 'dashboard'
          ? state.mosaicDashboard.getDashboard(blockInstanceId)
          : blockType === 'html-app'
            ? state.htmlApps.getApp(blockInstanceId)
            : state.tableExplorers.config.byId[blockInstanceId],
    }));
  const commands: RoomCommand<RoomState>[] = [
    ...createBlockDocumentCommands<RoomState>({
      defaultTitle: 'Untitled document',
      commandGroup: 'Document',
      allowedBlockTypes: [...EDITORIAL_BLOCKS, 'chart', 'statefulBlock'],
      statefulBlockTypes: blockTypes,
    }),
    ...createMosaicDashboardCommands<RoomState>(),
    ...createHtmlAppRevisionCommands<RoomState>({
      getHtmlAppIds: (state) => Object.keys(state.htmlApps.config.appsById),
      getHtmlAppState: (state, id) => state.htmlApps.getApp(id),
      renameHtmlApp: (state, id, title) => state.htmlApps.renameApp(id, title),
      commitHtmlAppRevision: (state, id, patch, meta) =>
        state.htmlApps.commitAppRevision(id, patch, meta),
      restoreHtmlAppRevision: (state, id, revision, meta) =>
        state.htmlApps.restoreAppRevision(id, revision, meta),
      undoHtmlAppRevision: (state, id) => state.htmlApps.undoAppRevision(id),
      redoHtmlAppRevision: (state, id) => state.htmlApps.redoAppRevision(id),
    }),
    ...createLocalDataCommands({
      metaNamespace: '__roomie',
      resolveLocalFile: options.resolveLocalFile,
    }),
    {
      id: 'data-table.configure',
      name: 'Configure document data table',
      group: 'Data table',
      description:
        'Persist filters, visible columns, sorting, and page size for a document table explorer.',
      inputSchema: z.object({
        blockInstanceId: z.string(),
        settings: TableSettings,
      }),
      metadata: {readOnly: false, riskLevel: 'low', idempotent: true},
      execute: ({getState}, raw) => {
        const {blockInstanceId, settings} = raw as {
          blockInstanceId: string;
          settings: z.infer<typeof TableSettings>;
        };
        if (
          !ownedBlocks(getState()).some(
            (b) =>
              b.type === 'statefulBlock' &&
              b.blockType === 'data-table' &&
              b.blockInstanceId === blockInstanceId,
          )
        )
          throw new Error('Unknown document table block.');
        getState().tableExplorers.update(blockInstanceId, settings);
        return {blockInstanceId, settings};
      },
    },
  ];
  return commands.map((command) => ({
    ...command,
    ...(command.id === 'block-document.create-stateful-block'
      ? {
          inputSchema: (command.inputSchema as z.ZodObject).extend({
            blockType: z.enum(STATEFUL_BLOCKS),
            ownership: z.literal('owned').optional(),
          }),
          description:
            'Create a document-owned data-table, dashboard, or html-app block.',
        }
      : {}),
    validateInput: async (raw, context) => {
      await command.validateInput?.(raw, context);
      const input = (raw ?? {}) as Record<string, any>;
      const state = context.getState();
      if (command.id === 'data-table.configure')
        await validateTableFilters(state.db, input.settings.filters);
      const blocks: BlockDocumentBlock[] = [
        ...(input.blocks ?? []),
        ...(input.block ? [input.block] : []),
      ];
      if (command.id === 'block-document.create-chart-block')
        validateChart(input.config);
      if (
        command.id === 'block-document.create-chart-block' ||
        command.id === 'block-document.create-stateful-block' ||
        command.id === 'dashboard.set-selected-table'
      )
        validateRenderSource(state.db, input.tableName);
      if (command.id === 'block-document.create-stateful-block') {
        if (!STATEFUL_BLOCKS.includes(input.blockType))
          throw new Error('Unsupported Roomie block.');
        if (input.ownership && input.ownership !== 'owned')
          throw new Error('Roomie blocks must be document-owned.');
        if (
          input.blockInstanceId &&
          ownedBlocks(state).some(
            (b) =>
              b.type === 'statefulBlock' &&
              b.blockInstanceId === input.blockInstanceId,
          )
        )
          throw new Error('Block instance already belongs to a document.');
      }
      const incomingInstances = new Set<string>();
      const existingBlocks = Object.entries(
        state.blockDocuments.config.artifacts,
      ).flatMap(([artifactId, document]) =>
        blockDocumentContentToBlocks(document.content).map((block) => ({
          artifactId,
          block,
        })),
      );
      for (const block of blocks) {
        validateBlock(block);
        validateBlockRenderSources(state.db, block);
        if ('text' in block)
          for (const node of block.text) validateDocumentNode(node);
        if (block.type === 'list')
          for (const item of block.items)
            for (const node of item) validateDocumentNode(node);
        if (block.type === 'statefulBlock') {
          if (incomingInstances.has(block.blockInstanceId))
            throw new Error('Incoming blocks cannot share an instance.');
          incomingInstances.add(block.blockInstanceId);
          if (
            existingBlocks.some(
              ({artifactId, block: b}) =>
                b.type === 'statefulBlock' &&
                b.blockInstanceId === block.blockInstanceId &&
                !(
                  command.id === 'block-document.update-block' &&
                  artifactId === input.artifactId &&
                  b.id === input.blockId
                ),
            )
          )
            throw new Error('Block instance already belongs to a document.');
        }
      }
      if (command.id.startsWith('dashboard.')) {
        if (
          !ownedBlocks(state).some(
            (b) =>
              b.type === 'statefulBlock' &&
              b.blockType === 'dashboard' &&
              b.blockInstanceId === input.dashboardId,
          )
        )
          throw new Error('Unknown document dashboard.');
        const existing = state.mosaicDashboard
          .getDashboard(input.dashboardId)
          ?.panels.find((p) => p.id === input.panelId);
        const panel =
          input.panel ??
          (input.patch && existing ? {...existing, ...input.patch} : undefined);
        if (panel) {
          if (panel.source?.sqlQuery)
            throw new Error(
              'Dashboard SQL sources must be materialized first.',
            );
          if (panel.source?.tableName)
            validateRenderSource(state.db, panel.source.tableName);
          if (
            !(
              ROOMIE_CAPABILITIES.dashboardPanels as readonly string[]
            ).includes(panel.type)
          )
            throw new Error('Unsupported Roomie dashboard panel.');
          if (panel.type === 'vgplot') validateChart(panel.config);
        }
      }
    },
  }));
}
