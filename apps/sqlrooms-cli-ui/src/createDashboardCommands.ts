import type {RoomCommand} from '@sqlrooms/room-shell';
import {z} from 'zod';

import type {RoomState} from './store';
import {parseVgPlotSpecString} from './vgplot';

export const DASHBOARD_COMMAND_OWNER = '@sqlrooms-cli-ui/dashboard';

const DashboardCreateSheetCommandInput = z
  .object({
    title: z.string().optional().describe('Optional dashboard sheet title.'),
  })
  .default({});
type DashboardCreateSheetCommandInput = z.infer<
  typeof DashboardCreateSheetCommandInput
>;

const DashboardSelectSheetCommandInput = z.object({
  sheetId: z.string().describe('Target dashboard sheet ID.'),
});
type DashboardSelectSheetCommandInput = z.infer<
  typeof DashboardSelectSheetCommandInput
>;

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

export function createDashboardCommands(): RoomCommand<RoomState>[] {
  return [
    {
      id: 'dashboard.create-sheet',
      name: 'Create dashboard sheet',
      description: 'Create a new dashboard sheet and select it',
      group: 'Dashboard',
      keywords: ['dashboard', 'sheet', 'create', 'new'],
      inputSchema: DashboardCreateSheetCommandInput,
      inputDescription: 'Optional title for the dashboard sheet.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {title} =
          (input as DashboardCreateSheetCommandInput | undefined) ?? {};
        const sheetId = getState().dashboard.createDashboardSheet(title);
        return {
          success: true,
          commandId: 'dashboard.create-sheet',
          message: `Created dashboard sheet "${sheetId}".`,
          data: {sheetId},
        };
      },
    },
    {
      id: 'dashboard.select-sheet',
      name: 'Select dashboard sheet',
      description: 'Switch current sheet to a dashboard sheet',
      group: 'Dashboard',
      keywords: ['dashboard', 'sheet', 'select', 'switch'],
      inputSchema: DashboardSelectSheetCommandInput,
      inputDescription: 'Provide the dashboard sheet ID.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        const {sheetId} = input as DashboardSelectSheetCommandInput;
        const sheet = getState().cells.config.sheets[sheetId];
        if (!sheet) {
          throw new Error(`Unknown sheet "${sheetId}".`);
        }
        if (sheet.type !== 'dashboard') {
          throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
        }
      },
      execute: ({getState}, input) => {
        const {sheetId} = input as DashboardSelectSheetCommandInput;
        getState().cells.setCurrentSheet(sheetId);
        getState().dashboard.ensureSheetDashboard(sheetId);
        return {
          success: true,
          commandId: 'dashboard.select-sheet',
          message: `Selected dashboard sheet "${sheetId}".`,
        };
      },
    },
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
