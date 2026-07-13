import {
  BlockDocumentStatefulBlockBlock,
  createDefaultBlockDocumentBlockId,
} from '@sqlrooms/documents';
import {getTableIdentity} from '@sqlrooms/duckdb';
import {
  createOrUpdateDeckMapResource,
  DeckMapResourceToolParameters,
  normalizeDeckMapPointConfig,
} from '@sqlrooms/deck';
import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';
import type {RoomState} from './store-types';

export const CLI_BLOCK_DOCUMENT_COMMAND_OWNER =
  '@sqlrooms-cli-ui/block-document';

const BLOCK_DOCUMENT_CREATE_STATEFUL_BLOCK_COMMAND_ID =
  'block-document.create-stateful-block';
const BLOCK_DOCUMENT_ADD_DASHBOARD_BLOCK_COMMAND_ID =
  'block-document.add-dashboard-block';
const BLOCK_DOCUMENT_ADD_DATA_TABLE_BLOCK_COMMAND_ID =
  'block-document.add-data-table-block';
const BLOCK_DOCUMENT_ADD_HTML_APP_BLOCK_COMMAND_ID =
  'block-document.add-html-app-block';
const BLOCK_DOCUMENT_UPDATE_BLOCK_METADATA_COMMAND_ID =
  'block-document.update-block-metadata';
const BLOCK_DOCUMENT_ADD_MAP_BLOCK_COMMAND_ID = 'block-document.add-map-block';
const DASHBOARD_SET_SELECTED_TABLE_COMMAND_ID = 'dashboard.set-selected-table';

const BlockDocumentIdInput = z.object({
  blockDocumentId: z.string().describe('Target block document artifact ID.'),
});

const BlockDocumentAddDashboardBlockInput = BlockDocumentIdInput.extend({
  title: z.string().default('Dashboard').describe('Dashboard block title.'),
  tableName: z.string().describe('Selected table for the dashboard.'),
  intent: z
    .string()
    .optional()
    .describe('Optional durable purpose for this block document block.'),
});

const BlockDocumentAddDataTableBlockInput = BlockDocumentIdInput.extend({
  title: z
    .string()
    .default('Data Table Explorer')
    .describe('Data table block caption.'),
  tableName: z.string().describe('Table shown by the data table block.'),
  intent: z
    .string()
    .optional()
    .describe('Optional durable purpose for this block document block.'),
});

const BlockDocumentAddHtmlAppBlockInput = BlockDocumentIdInput.extend({
  title: z.string().default('HTML App').describe('HTML app block title.'),
  intent: z
    .string()
    .optional()
    .describe('Optional durable purpose for this block document block.'),
});

const BlockDocumentUpdateBlockMetadataInput = BlockDocumentIdInput.extend({
  blockId: z.string().describe('Block document block ID to update.'),
  caption: z.string().optional().describe('Updated block caption.'),
  height: z.number().positive().optional().describe('Updated block height.'),
});

export const BlockDocumentMapBlockToolParameters =
  DeckMapResourceToolParameters.extend({
    title: z.string().optional().describe('Map title.'),
    blockDocumentId: z.string().describe('Target block document artifact ID.'),
    mapId: z
      .string()
      .optional()
      .describe('Existing block document map block resource ID to update.'),
    intent: z
      .string()
      .optional()
      .describe('Durable purpose for this block document map block.'),
  });

type BlockDocumentMapBlockToolParameters = z.infer<
  typeof BlockDocumentMapBlockToolParameters
>;

function resolveBlockDocumentArtifact(
  state: RoomState,
  blockDocumentId: string,
) {
  const artifact = state.artifacts.getArtifact(blockDocumentId);
  if (!artifact || artifact.type !== 'worksheet') {
    throw new Error(
      `Artifact ${blockDocumentId} is not a Worksheet block document`,
    );
  }
  state.blockDocuments.ensureBlockDocument(blockDocumentId);
  return artifact;
}

async function invokeRequiredCommand(
  state: RoomState,
  commandId: string,
  input: unknown,
) {
  const result = await state.commands.invokeCommand(commandId, input, {
    surface: 'ai',
    actor: 'block-document-command',
  });
  if (!result.success) {
    throw new Error(
      result.error ?? result.message ?? `Failed to execute ${commandId}`,
    );
  }
  return result;
}

function statefulBlockFromCommandData(data: unknown): {
  blockId: string;
  blockInstanceId: string;
} {
  const value = data as
    | {blockId?: string; blockIds?: string[]; blockInstanceId?: string}
    | undefined;
  const blockId = value?.blockId ?? value?.blockIds?.[0];
  const blockInstanceId = value?.blockInstanceId;
  if (!blockId || !blockInstanceId) {
    throw new Error('Stateful block command did not return block IDs.');
  }
  return {blockId, blockInstanceId};
}

function findStatefulBlock(
  state: RoomState,
  blockDocumentId: string,
  blockInstanceId: string,
  blockType: string,
) {
  return state.blockDocuments
    .getBlocks(blockDocumentId)
    .find((block: unknown): block is BlockDocumentStatefulBlockBlock => {
      if (typeof block !== 'object' || block === null) {
        return false;
      }
      const candidate = block as Partial<BlockDocumentStatefulBlockBlock>;
      return (
        candidate.type === 'statefulBlock' &&
        candidate.blockType === blockType &&
        candidate.blockInstanceId === blockInstanceId
      );
    });
}

export function createCliBlockDocumentCommands(): RoomCommand<RoomState>[] {
  return [
    {
      id: BLOCK_DOCUMENT_ADD_DASHBOARD_BLOCK_COMMAND_ID,
      name: 'Add block document dashboard block',
      description: 'Add an owned dashboard block to a block document.',
      group: 'Worksheet',
      keywords: ['block document', 'dashboard', 'block', 'add'],
      inputSchema: BlockDocumentAddDashboardBlockInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const {blockDocumentId, title, tableName, intent} = input as z.infer<
          typeof BlockDocumentAddDashboardBlockInput
        >;
        const state = getState();
        resolveBlockDocumentArtifact(state, blockDocumentId);
        const table = state.db.findTable(tableName);
        if (!table) {
          throw new Error(`Table ${tableName} was not found`);
        }
        const tableIdentity = getTableIdentity(table.table);
        const result = await invokeRequiredCommand(
          state,
          BLOCK_DOCUMENT_CREATE_STATEFUL_BLOCK_COMMAND_ID,
          {
            artifactId: blockDocumentId,
            blockType: 'dashboard',
            intent,
            title,
            caption: title,
            height: 560,
          },
        );
        const {blockId, blockInstanceId: dashboardId} =
          statefulBlockFromCommandData(result.data);
        await invokeRequiredCommand(
          state,
          DASHBOARD_SET_SELECTED_TABLE_COMMAND_ID,
          {dashboardId, tableName: tableIdentity},
        );
        return {
          success: true,
          commandId: BLOCK_DOCUMENT_ADD_DASHBOARD_BLOCK_COMMAND_ID,
          message: `Added block document dashboard block "${title}".`,
          data: {
            blockDocumentId,
            blockId,
            dashboardId,
            selectedTable: tableIdentity,
          },
        };
      },
    },
    {
      id: BLOCK_DOCUMENT_ADD_DATA_TABLE_BLOCK_COMMAND_ID,
      name: 'Add block document data table block',
      description: 'Add a data table explorer block to a block document.',
      group: 'Worksheet',
      keywords: ['block document', 'data table', 'block', 'add'],
      inputSchema: BlockDocumentAddDataTableBlockInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const {blockDocumentId, title, tableName, intent} = input as z.infer<
          typeof BlockDocumentAddDataTableBlockInput
        >;
        const state = getState();
        resolveBlockDocumentArtifact(state, blockDocumentId);
        const table = state.db.findTable(tableName);
        if (!table) {
          throw new Error(`Table ${tableName} was not found`);
        }
        const tableIdentity = getTableIdentity(table.table);
        const result = await invokeRequiredCommand(
          state,
          BLOCK_DOCUMENT_CREATE_STATEFUL_BLOCK_COMMAND_ID,
          {
            artifactId: blockDocumentId,
            blockType: 'data-table',
            intent,
            caption: title,
            tableName: tableIdentity,
            height: 640,
          },
        );
        const {blockId, blockInstanceId} = statefulBlockFromCommandData(
          result.data,
        );
        return {
          success: true,
          commandId: BLOCK_DOCUMENT_ADD_DATA_TABLE_BLOCK_COMMAND_ID,
          message: `Added block document data table block "${title}".`,
          data: {
            blockDocumentId,
            blockId,
            dataTableId: blockInstanceId,
            selectedTable: tableIdentity,
          },
        };
      },
    },
    {
      id: BLOCK_DOCUMENT_ADD_HTML_APP_BLOCK_COMMAND_ID,
      name: 'Add block document HTML app block',
      description: 'Add an owned HTML app block to a block document.',
      group: 'Worksheet',
      keywords: ['block document', 'html', 'app', 'block', 'add'],
      inputSchema: BlockDocumentAddHtmlAppBlockInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const {blockDocumentId, title, intent} = input as z.infer<
          typeof BlockDocumentAddHtmlAppBlockInput
        >;
        const state = getState();
        resolveBlockDocumentArtifact(state, blockDocumentId);
        const result = await invokeRequiredCommand(
          state,
          BLOCK_DOCUMENT_CREATE_STATEFUL_BLOCK_COMMAND_ID,
          {
            artifactId: blockDocumentId,
            blockType: 'html-app',
            intent,
            title,
            caption: title,
            height: 560,
          },
        );
        const {blockId, blockInstanceId: appId} = statefulBlockFromCommandData(
          result.data,
        );
        return {
          success: true,
          commandId: BLOCK_DOCUMENT_ADD_HTML_APP_BLOCK_COMMAND_ID,
          message: `Added block document HTML app block "${title}".`,
          data: {blockDocumentId, blockId, appId},
        };
      },
    },
    {
      id: BLOCK_DOCUMENT_UPDATE_BLOCK_METADATA_COMMAND_ID,
      name: 'Update block document block metadata',
      description: 'Update caption or height for a block document block.',
      group: 'Worksheet',
      keywords: ['block document', 'block', 'metadata', 'update'],
      inputSchema: BlockDocumentUpdateBlockMetadataInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const {blockDocumentId, blockId, caption, height} = input as z.infer<
          typeof BlockDocumentUpdateBlockMetadataInput
        >;
        const state = getState();
        resolveBlockDocumentArtifact(state, blockDocumentId);
        const existing = state.blockDocuments
          .getBlocks(blockDocumentId)
          .find((block: {id?: string}) => block.id === blockId);
        if (!existing) {
          throw new Error(
            `Block document block ${blockId} was not found in ${blockDocumentId}`,
          );
        }
        const updated = state.blockDocuments.updateBlock(
          blockDocumentId,
          blockId,
          {
            ...existing,
            ...(caption !== undefined ? {caption} : {}),
            ...(height !== undefined ? {height} : {}),
          },
        );
        if (!updated) {
          throw new Error(`Failed to update block document block ${blockId}`);
        }
        return {
          success: true,
          commandId: BLOCK_DOCUMENT_UPDATE_BLOCK_METADATA_COMMAND_ID,
          message: `Updated block document block "${blockId}".`,
          data: {
            blockDocumentId,
            blockId,
            caption:
              caption ?? ('caption' in existing ? existing.caption : undefined),
            height:
              height ?? ('height' in existing ? existing.height : undefined),
          },
        };
      },
    },
    {
      id: BLOCK_DOCUMENT_ADD_MAP_BLOCK_COMMAND_ID,
      name: 'Add or update block document map block',
      description: 'Create or update a direct block document map block.',
      group: 'Worksheet',
      keywords: ['block document', 'map', 'deck', 'block', 'add', 'update'],
      inputSchema: BlockDocumentMapBlockToolParameters,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const params = input as BlockDocumentMapBlockToolParameters;
        const state = getState();
        resolveBlockDocumentArtifact(state, params.blockDocumentId);

        const result = await createOrUpdateDeckMapResource(
          {
            ensureBlockDocument: (id) =>
              state.blockDocuments.ensureBlockDocument(id),
            findMapBlock: (docId, mapId) => {
              const block = findStatefulBlock(state, docId, mapId, 'map');
              return block?.blockInstanceId
                ? {
                    blockId: block.id,
                    mapId: block.blockInstanceId,
                    caption: 'caption' in block ? block.caption : undefined,
                  }
                : undefined;
            },
            findMap: (mapId) => state.deckMaps.getMap(mapId),
            createMapBlock: async ({
              blockDocumentId,
              mapId,
              title,
              caption,
              intent,
              height,
            }) => {
              const createResult = await invokeRequiredCommand(
                state,
                BLOCK_DOCUMENT_CREATE_STATEFUL_BLOCK_COMMAND_ID,
                {
                  artifactId: blockDocumentId,
                  blockType: 'map',
                  blockInstanceId: mapId,
                  intent,
                  title,
                  caption: caption ?? title,
                  height: height ?? 560,
                },
              );
              return {
                blockId: statefulBlockFromCommandData(createResult.data)
                  .blockId,
                mapId,
              };
            },
            updateBlockMetadata: async ({
              blockDocumentId,
              blockId,
              caption,
              height,
            }) => {
              await invokeRequiredCommand(
                state,
                BLOCK_DOCUMENT_UPDATE_BLOCK_METADATA_COMMAND_ID,
                {
                  blockDocumentId,
                  blockId,
                  caption,
                  height,
                },
              );
            },
            ensureMap: (mapId, title) =>
              state.deckMaps.ensureMap(mapId, {title}),
            writeMap: ({mapId, title, config, selectedTable}) => {
              state.deckMaps.updateMap(mapId, {title, config, selectedTable});
            },
            findTable: (tableName) => {
              const table = state.db.findTable(tableName);
              return table
                ? {tableIdentity: getTableIdentity(table.table)}
                : undefined;
            },
            prepareConfig: ({config}) =>
              normalizeDeckMapPointConfig({
                config,
                resolveTable: (tableName) => state.db.findTable(tableName),
              }),
          },
          {
            blockDocumentId: params.blockDocumentId,
            config: params.config,
            mapId: params.mapId,
            tableName: params.tableName,
            title: params.title,
            intent: params.intent,
            artifactLabel: 'block document',
            missingMapBlockBehavior: 'throw',
            createMapId: () => createDefaultBlockDocumentBlockId(),
          },
        );

        return {
          success: true,
          commandId: BLOCK_DOCUMENT_ADD_MAP_BLOCK_COMMAND_ID,
          message: result.message,
          data: {
            blockDocumentId: result.blockDocumentId,
            blockId: result.blockId,
            mapId: result.mapId,
            selectedTable: result.selectedTable,
          },
        };
      },
    },
  ];
}
