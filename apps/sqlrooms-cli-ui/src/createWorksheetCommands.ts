import {
  BlockDocumentStatefulBlockBlock,
  createDefaultBlockDocumentBlockId,
} from '@sqlrooms/documents';
import {getTableIdentity} from '@sqlrooms/duckdb';
import {
  createDeckMapPanelFromNativeConfig,
  DeckMapDashboardToolParameters,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardConfigToolConfig,
} from '@sqlrooms/deck';
import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';
import type {RoomState} from './store-types';

export const CLI_WORKSHEET_COMMAND_OWNER = '@sqlrooms-cli-ui/block-document';

const WORKSHEET_CREATE_STATEFUL_BLOCK_COMMAND_ID =
  'block-document.create-stateful-block';
const DASHBOARD_SET_SELECTED_TABLE_COMMAND_ID = 'dashboard.set-selected-table';

const WorksheetIdInput = z.object({
  worksheetId: z.string().describe('Target worksheet artifact ID.'),
});

const WorksheetAddDashboardBlockInput = WorksheetIdInput.extend({
  title: z.string().default('Dashboard').describe('Dashboard block title.'),
  tableName: z.string().describe('Selected table for the dashboard.'),
  intent: z
    .string()
    .optional()
    .describe('Optional durable purpose for this worksheet block.'),
});

const WorksheetAddDataTableBlockInput = WorksheetIdInput.extend({
  title: z
    .string()
    .default('Data Table Explorer')
    .describe('Data table block caption.'),
  tableName: z.string().describe('Table shown by the data table block.'),
  intent: z
    .string()
    .optional()
    .describe('Optional durable purpose for this worksheet block.'),
});

const WorksheetAddHtmlAppBlockInput = WorksheetIdInput.extend({
  title: z.string().default('HTML App').describe('HTML app block title.'),
  intent: z
    .string()
    .optional()
    .describe('Optional durable purpose for this worksheet block.'),
});

const WorksheetUpdateBlockMetadataInput = WorksheetIdInput.extend({
  blockId: z.string().describe('Worksheet document block ID to update.'),
  title: z.string().optional().describe('Updated block title.'),
  caption: z.string().optional().describe('Updated block caption.'),
  height: z.number().positive().optional().describe('Updated block height.'),
});

export const WorksheetMapBlockToolParameters =
  DeckMapDashboardToolParameters.extend({
    worksheetId: z.string().describe('Target worksheet artifact ID.'),
    mapId: z
      .string()
      .optional()
      .describe('Existing worksheet map block resource ID to update.'),
    intent: z
      .string()
      .optional()
      .describe('Durable purpose for this worksheet map block.'),
  });

type WorksheetMapBlockToolParameters = z.infer<
  typeof WorksheetMapBlockToolParameters
>;

function getFirstDatasetSourceTableName(
  config: DeckMapDashboardConfigToolConfig,
): string | undefined {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return undefined;
  }

  return Object.values(config.datasets)
    .map(
      (dataset) =>
        (dataset as Record<string, unknown>).source as
          | {tableName?: string}
          | undefined,
    )
    .find((source) => source?.tableName)?.tableName;
}

function hasSqlOnlyDatasetSource(
  config: DeckMapDashboardConfigToolConfig,
): boolean {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return false;
  }

  return Object.values(config.datasets).some((dataset) => {
    const source = (dataset as Record<string, unknown>).source as
      | {tableName?: string; sqlQuery?: string}
      | undefined;
    return Boolean(source?.sqlQuery && !source.tableName);
  });
}

function resolveWorksheet(state: RoomState, worksheetId: string) {
  const artifact = state.artifacts.getArtifact(worksheetId);
  if (!artifact || artifact.type !== 'worksheet') {
    throw new Error(`Artifact ${worksheetId} is not a worksheet`);
  }
  state.blockDocuments.ensureBlockDocument(worksheetId);
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
  worksheetId: string,
  blockInstanceId: string,
  blockType: string,
) {
  return state.blockDocuments
    .getBlocks(worksheetId)
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

function findMapPanel(state: RoomState, mapId: string, panelId?: string) {
  const dashboard = state.mosaicDashboard.getDashboard(mapId);
  if (panelId) {
    return dashboard?.panels.find(
      (candidate: {id?: string; type?: string}) =>
        candidate.id === panelId &&
        candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
    );
  }
  return dashboard?.panels.find(
    (candidate: {type?: string}) =>
      candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
  );
}

export function createWorksheetCommands(): RoomCommand<RoomState>[] {
  return [
    {
      id: 'block-document.add-dashboard-block',
      name: 'Add worksheet dashboard block',
      description: 'Add an owned dashboard block to a worksheet.',
      group: 'Worksheet',
      keywords: ['worksheet', 'dashboard', 'block', 'add'],
      inputSchema: WorksheetAddDashboardBlockInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const {worksheetId, title, tableName, intent} = input as z.infer<
          typeof WorksheetAddDashboardBlockInput
        >;
        const state = getState();
        resolveWorksheet(state, worksheetId);
        const table = state.db.findTable(tableName);
        if (!table) {
          throw new Error(`Table ${tableName} was not found`);
        }
        const tableIdentity = getTableIdentity(table.table);
        const result = await invokeRequiredCommand(
          state,
          WORKSHEET_CREATE_STATEFUL_BLOCK_COMMAND_ID,
          {
            artifactId: worksheetId,
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
          commandId: 'block-document.add-dashboard-block',
          message: `Added worksheet dashboard block "${title}".`,
          data: {
            worksheetId,
            blockId,
            dashboardId,
            selectedTable: tableIdentity,
          },
        };
      },
    },
    {
      id: 'block-document.add-data-table-block',
      name: 'Add worksheet data table block',
      description: 'Add a data table explorer block to a worksheet.',
      group: 'Worksheet',
      keywords: ['worksheet', 'data table', 'block', 'add'],
      inputSchema: WorksheetAddDataTableBlockInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const {worksheetId, title, tableName, intent} = input as z.infer<
          typeof WorksheetAddDataTableBlockInput
        >;
        const state = getState();
        resolveWorksheet(state, worksheetId);
        const table = state.db.findTable(tableName);
        if (!table) {
          throw new Error(`Table ${tableName} was not found`);
        }
        const tableIdentity = getTableIdentity(table.table);
        const result = await invokeRequiredCommand(
          state,
          WORKSHEET_CREATE_STATEFUL_BLOCK_COMMAND_ID,
          {
            artifactId: worksheetId,
            blockType: 'data-table',
            intent,
            title: tableIdentity,
            caption: title,
            height: 640,
          },
        );
        const {blockId, blockInstanceId} = statefulBlockFromCommandData(
          result.data,
        );
        return {
          success: true,
          commandId: 'block-document.add-data-table-block',
          message: `Added worksheet data table block "${title}".`,
          data: {
            worksheetId,
            blockId,
            dataTableId: blockInstanceId,
            selectedTable: tableIdentity,
          },
        };
      },
    },
    {
      id: 'block-document.add-html-app-block',
      name: 'Add worksheet HTML app block',
      description: 'Add an owned HTML app block to a worksheet.',
      group: 'Worksheet',
      keywords: ['worksheet', 'html', 'app', 'block', 'add'],
      inputSchema: WorksheetAddHtmlAppBlockInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const {worksheetId, title, intent} = input as z.infer<
          typeof WorksheetAddHtmlAppBlockInput
        >;
        const state = getState();
        resolveWorksheet(state, worksheetId);
        const result = await invokeRequiredCommand(
          state,
          WORKSHEET_CREATE_STATEFUL_BLOCK_COMMAND_ID,
          {
            artifactId: worksheetId,
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
          commandId: 'block-document.add-html-app-block',
          message: `Added worksheet HTML app block "${title}".`,
          data: {worksheetId, blockId, appId},
        };
      },
    },
    {
      id: 'block-document.update-block-metadata',
      name: 'Update worksheet block metadata',
      description: 'Update title, caption, or height for a worksheet block.',
      group: 'Worksheet',
      keywords: ['worksheet', 'block', 'metadata', 'update'],
      inputSchema: WorksheetUpdateBlockMetadataInput,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: ({getState}, input) => {
        const {worksheetId, blockId, title, caption, height} = input as z.infer<
          typeof WorksheetUpdateBlockMetadataInput
        >;
        const state = getState();
        resolveWorksheet(state, worksheetId);
        const existing = state.blockDocuments
          .getBlocks(worksheetId)
          .find((block: {id?: string}) => block.id === blockId);
        if (!existing) {
          throw new Error(
            `Worksheet block ${blockId} was not found in worksheet ${worksheetId}`,
          );
        }
        const updated = state.blockDocuments.updateBlock(worksheetId, blockId, {
          ...existing,
          ...(title !== undefined ? {title} : {}),
          ...(caption !== undefined ? {caption} : {}),
          ...(height !== undefined ? {height} : {}),
        });
        if (!updated) {
          throw new Error(`Failed to update worksheet block ${blockId}`);
        }
        return {
          success: true,
          commandId: 'block-document.update-block-metadata',
          message: `Updated worksheet block "${blockId}".`,
          data: {worksheetId, blockId, title, caption, height},
        };
      },
    },
    {
      id: 'block-document.add-map-block',
      name: 'Add or update worksheet map block',
      description: 'Create or update a direct worksheet map block.',
      group: 'Worksheet',
      keywords: ['worksheet', 'map', 'deck', 'block', 'add', 'update'],
      inputSchema: WorksheetMapBlockToolParameters,
      metadata: {readOnly: false, idempotent: false, riskLevel: 'medium'},
      execute: async ({getState}, input) => {
        const params = input as WorksheetMapBlockToolParameters;
        const state = getState();
        resolveWorksheet(state, params.worksheetId);

        const tableName =
          params.tableName ?? getFirstDatasetSourceTableName(params.config);
        if (
          params.mapId &&
          !tableName &&
          hasSqlOnlyDatasetSource(params.config)
        ) {
          throw new Error(
            'tableName is required when updating a worksheet map block with SQL-only dataset sources',
          );
        }
        const table = tableName ? state.db.findTable(tableName) : undefined;
        if (tableName && !table) {
          throw new Error(`Table ${tableName} was not found`);
        }
        const tableIdentity = table ? getTableIdentity(table.table) : undefined;

        const mapId = params.mapId ?? createDefaultBlockDocumentBlockId();
        const title = params.title || 'Map';
        const existingMapBlock = params.mapId
          ? findStatefulBlock(state, params.worksheetId, params.mapId, 'map')
          : undefined;
        if (params.mapId && !existingMapBlock) {
          throw new Error(
            `Worksheet map block ${params.mapId} was not found in worksheet ${params.worksheetId}`,
          );
        }

        let existingPanel = findMapPanel(state, mapId, params.panelId);
        if (params.panelId && !existingPanel) {
          throw new Error(`Map panel ${params.panelId} was not found`);
        }

        let blockId: string;
        if (existingMapBlock) {
          blockId = existingMapBlock.id;
        } else {
          const result = await invokeRequiredCommand(
            state,
            WORKSHEET_CREATE_STATEFUL_BLOCK_COMMAND_ID,
            {
              artifactId: params.worksheetId,
              blockType: 'map',
              blockInstanceId: mapId,
              intent: params.intent,
              title,
              caption: title,
              height: 560,
            },
          );
          blockId = statefulBlockFromCommandData(result.data).blockId;
          existingPanel = findMapPanel(state, mapId, params.panelId);
        }

        state.mosaicDashboard.ensureDashboard(mapId, title, 'grid');
        if (tableName) {
          await invokeRequiredCommand(
            state,
            DASHBOARD_SET_SELECTED_TABLE_COMMAND_ID,
            {dashboardId: mapId, tableName: tableIdentity},
          );
        }

        const panel = createDeckMapPanelFromNativeConfig({
          title,
          config: params.config,
        });
        if (existingPanel) {
          await invokeRequiredCommand(state, 'dashboard.update-panel', {
            dashboardId: mapId,
            panelId: existingPanel.id,
            patch: {title: panel.title, config: panel.config},
          });
        } else {
          await invokeRequiredCommand(state, 'dashboard.add-panel', {
            dashboardId: mapId,
            panel,
          });
        }

        if (existingMapBlock) {
          await invokeRequiredCommand(
            state,
            'block-document.update-block-metadata',
            {
              worksheetId: params.worksheetId,
              blockId: existingMapBlock.id,
              title,
              caption: title,
            },
          );
        }

        return {
          success: true,
          commandId: 'block-document.add-map-block',
          message: params.mapId
            ? `Updated worksheet map block "${title}".`
            : `Added worksheet map block "${title}".`,
          data: {
            worksheetId: params.worksheetId,
            blockId,
            mapId,
            panelId: existingPanel?.id ?? panel.id,
            selectedTable: tableIdentity,
          },
        };
      },
    },
  ];
}
