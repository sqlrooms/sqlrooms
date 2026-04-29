import type {SheetType} from '@sqlrooms/cells';
import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';

import {parseVgPlotSpecString} from './vgplot';
import {RoomState} from './store-types';

export const DASHBOARD_COMMAND_OWNER = '@sqlrooms-cli-ui/dashboard';

// ---------------------------------------------------------------------------
// Shared input schemas for generic sheet commands
// ---------------------------------------------------------------------------

const CreateSheetCommandInput = z
  .object({
    title: z.string().optional().describe('Optional sheet title.'),
  })
  .default({});
type CreateSheetCommandInput = z.infer<typeof CreateSheetCommandInput>;

const SelectSheetCommandInput = z.object({
  sheetId: z.string().describe('Target sheet ID.'),
});
type SelectSheetCommandInput = z.infer<typeof SelectSheetCommandInput>;

// ---------------------------------------------------------------------------
// Dashboard-specific input schemas
// ---------------------------------------------------------------------------

const DashboardSetVgPlotCommandInput = z.object({
  sheetId: z
    .string()
    .optional()
    .describe('Optional dashboard sheet ID. Defaults to current dashboard.'),
  vgplot: z
    .string()
    .describe('VgPlot JSON string for the dashboard specification.'),
});
type DashboardSetVgPlotCommandInput = z.infer<
  typeof DashboardSetVgPlotCommandInput
>;

const DashboardGetVgPlotCommandInput = z
  .object({
    sheetId: z
      .string()
      .optional()
      .describe('Optional dashboard sheet ID. Defaults to current dashboard.'),
  })
  .default({});
type DashboardGetVgPlotCommandInput = z.infer<
  typeof DashboardGetVgPlotCommandInput
>;

// ---------------------------------------------------------------------------
// Generic create-sheet helper per sheet type
// ---------------------------------------------------------------------------

function createSheetCommand(
  sheetType: SheetType,
  group: string,
): RoomCommand<RoomState> {
  const id = `${sheetType}.create-sheet`;
  return {
    id,
    name: `Create ${group.toLowerCase()} sheet`,
    description: `Create a new ${group.toLowerCase()} sheet and select it`,
    group,
    keywords: [sheetType, 'sheet', 'create', 'new'],
    inputSchema: CreateSheetCommandInput,
    inputDescription: `Optional title for the ${group.toLowerCase()} sheet.`,
    metadata: {
      readOnly: false,
      idempotent: false,
      riskLevel: 'low',
    },
    execute: ({getState}, input) => {
      const {title} = (input as CreateSheetCommandInput | undefined) ?? {};
      const sheetId = getState().cells.addSheet(title, sheetType);
      getState().cells.setCurrentSheet(sheetId);
      return {
        success: true,
        commandId: id,
        message: `Created ${group.toLowerCase()} sheet "${sheetId}".`,
        data: {sheetId},
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Dashboard-specific create command (uses dashboard slice for extra state)
// ---------------------------------------------------------------------------

function createDashboardCreateSheetCommand(): RoomCommand<RoomState> {
  return {
    id: 'dashboard.create-sheet',
    name: 'Create dashboard sheet',
    description: 'Create a new dashboard sheet and select it',
    group: 'Dashboard',
    keywords: ['dashboard', 'sheet', 'create', 'new'],
    inputSchema: CreateSheetCommandInput,
    inputDescription: 'Optional title for the dashboard sheet.',
    metadata: {
      readOnly: false,
      idempotent: false,
      riskLevel: 'low',
    },
    execute: ({getState}, input) => {
      const {title} = (input as CreateSheetCommandInput | undefined) ?? {};
      const sheetId = getState().dashboard.createDashboardSheet(title);
      return {
        success: true,
        commandId: 'dashboard.create-sheet',
        message: `Created dashboard sheet "${sheetId}".`,
        data: {sheetId},
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createDashboardCommands(): RoomCommand<RoomState>[] {
  return [
    // Universal select (works for any sheet type)
    {
      id: 'sheet.select',
      name: 'Select sheet',
      description: 'Switch to an existing sheet by ID',
      group: 'Sheets',
      keywords: ['sheet', 'select', 'switch'],
      inputSchema: SelectSheetCommandInput,
      inputDescription: 'Provide the sheet ID.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        const {sheetId} = input as SelectSheetCommandInput;
        const sheet = getState().cells.config.sheets[sheetId];
        if (!sheet) {
          throw new Error(`Unknown sheet "${sheetId}".`);
        }
      },
      execute: ({getState}, input) => {
        const {sheetId} = input as SelectSheetCommandInput;
        const state = getState();
        state.cells.setCurrentSheet(sheetId);
        const sheet = state.cells.config.sheets[sheetId];
        if (sheet?.type === 'dashboard') {
          state.dashboard.ensureSheetDashboard(sheetId);
        }
        return {
          success: true,
          commandId: 'sheet.select',
          message: `Selected sheet "${sheetId}".`,
        };
      },
    },

    // Per-type create commands
    createSheetCommand('notebook', 'Notebook'),
    createSheetCommand('canvas', 'Canvas'),
    createSheetCommand('app', 'App'),
    createDashboardCreateSheetCommand(),
    {
      id: 'dashboard.set-vgplot',
      name: 'Set dashboard vgplot',
      description: 'Set the vgplot JSON spec for a dashboard sheet',
      group: 'Dashboard',
      keywords: ['dashboard', 'vgplot', 'spec', 'json', 'update'],
      inputSchema: DashboardSetVgPlotCommandInput,
      inputDescription: 'Provide vgplot JSON and optional dashboard sheet ID.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      validateInput: (input, {getState}) => {
        const {sheetId, vgplot} = input as DashboardSetVgPlotCommandInput;
        parseVgPlotSpecString(vgplot);
        if (!sheetId) return;
        const sheet = getState().cells.config.sheets[sheetId];
        if (!sheet) {
          throw new Error(`Unknown sheet "${sheetId}".`);
        }
        if (sheet.type !== 'dashboard') {
          throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
        }
      },
      execute: ({getState}, input) => {
        const {sheetId, vgplot} = input as DashboardSetVgPlotCommandInput;
        const state = getState();
        const targetSheetId =
          sheetId ??
          state.dashboard.getCurrentDashboardSheetId() ??
          state.dashboard.createDashboardSheet();
        state.dashboard.setSheetVgPlot(targetSheetId, vgplot);
        state.cells.setCurrentSheet(targetSheetId);
        return {
          success: true,
          commandId: 'dashboard.set-vgplot',
          message: `Updated dashboard spec for "${targetSheetId}".`,
          data: {sheetId: targetSheetId},
        };
      },
    },
    {
      id: 'dashboard.get-vgplot',
      name: 'Get dashboard vgplot',
      description: 'Read the current vgplot JSON spec for a dashboard sheet',
      group: 'Dashboard',
      keywords: ['dashboard', 'vgplot', 'spec', 'json', 'read'],
      inputSchema: DashboardGetVgPlotCommandInput,
      inputDescription: 'Optional dashboard sheet ID.',
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {sheetId} =
          (input as DashboardGetVgPlotCommandInput | undefined) ?? {};
        const state = getState();
        const targetSheetId =
          sheetId ?? state.dashboard.getCurrentDashboardSheetId();
        if (!targetSheetId) {
          return {
            success: false,
            commandId: 'dashboard.get-vgplot',
            error: 'No dashboard sheet is available.',
          };
        }
        const sheet = state.cells.config.sheets[targetSheetId];
        if (!sheet || sheet.type !== 'dashboard') {
          return {
            success: false,
            commandId: 'dashboard.get-vgplot',
            error: `Sheet "${targetSheetId}" is not a dashboard sheet.`,
          };
        }
        state.dashboard.ensureSheetDashboard(targetSheetId);
        const vgplot = state.dashboard.getSheetVgPlot(targetSheetId);
        return {
          success: true,
          commandId: 'dashboard.get-vgplot',
          data: {
            sheetId: targetSheetId,
            vgplot,
          },
        };
      },
    },
  ];
}
