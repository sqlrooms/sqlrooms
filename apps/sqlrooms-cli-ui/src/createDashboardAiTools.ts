import {tool} from 'ai';
import {z} from 'zod';

import type {RoomState} from './store';
import {getErrorMessage} from './utils';
import {toVgPlotSpecString} from './vgplot';

const DashboardCreateSheetToolParameters = z
  .object({
    title: z.string().optional(),
  })
  .default({});
type DashboardCreateSheetToolParameters = z.infer<
  typeof DashboardCreateSheetToolParameters
>;

const DashboardGetVgPlotToolParameters = z
  .object({
    sheetId: z.string().optional(),
  })
  .default({});
type DashboardGetVgPlotToolParameters = z.infer<
  typeof DashboardGetVgPlotToolParameters
>;

const DashboardSetVgPlotToolParameters = z.object({
  sheetId: z
    .string()
    .optional()
    .describe('Optional target dashboard sheet ID.'),
  vgplot: z
    .union([z.string(), z.object({}).passthrough()])
    .describe('Dashboard vgplot specification as JSON string or object.'),
  createSheetIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true and no dashboard sheet is selected, create one automatically.',
    ),
});
type DashboardSetVgPlotToolParameters = z.infer<
  typeof DashboardSetVgPlotToolParameters
>;

export const DASHBOARD_AI_INSTRUCTIONS = `
Dashboard authoring:
- Use the dashboard tools to create/update dashboard vgplot specs.
- Prefer \`set_dashboard_vgplot\` with complete JSON.
- Ensure specs are valid JSON objects compatible with https://idl.uw.edu/mosaic/schema/latest.json.
- Use SQL against DuckDB tables when deciding fields, filters, and aggregations in the spec.
`;

export function createDashboardAiTools(store: {getState: () => RoomState}) {
  return {
    create_dashboard_sheet: tool({
      description:
        'Create a new dashboard sheet and make it the active sheet. Use when no dashboard sheet exists yet.',
      inputSchema: DashboardCreateSheetToolParameters,
      execute: async (params: DashboardCreateSheetToolParameters) => {
        const {title} = params;
        const sheetId = store.getState().dashboard.createDashboardSheet(title);
        return {
          llmResult: {
            success: true,
            details: `Created dashboard sheet "${sheetId}".`,
            data: {sheetId},
          },
        };
      },
    }),
    get_dashboard_vgplot: tool({
      description:
        'Get the current vgplot JSON spec for a dashboard sheet. If sheetId is omitted, uses the current dashboard sheet.',
      inputSchema: DashboardGetVgPlotToolParameters,
      execute: async (params: DashboardGetVgPlotToolParameters) => {
        const state = store.getState();
        const targetSheetId =
          params.sheetId ?? state.dashboard.getCurrentDashboardSheetId();
        if (!targetSheetId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard sheet found. Create one with create_dashboard_sheet first.',
            },
          };
        }
        const sheet = state.cells.config.sheets[targetSheetId];
        if (!sheet || sheet.type !== 'dashboard') {
          return {
            llmResult: {
              success: false,
              errorMessage: `Sheet "${targetSheetId}" is not a dashboard sheet.`,
            },
          };
        }
        state.dashboard.ensureSheetDashboard(targetSheetId);
        const vgplot = state.dashboard.getSheetVgPlot(targetSheetId);
        return {
          llmResult: {
            success: true,
            details: `Loaded dashboard spec from "${targetSheetId}".`,
            data: {
              sheetId: targetSheetId,
              vgplot,
            },
          },
        };
      },
    }),
    set_dashboard_vgplot: tool({
      description:
        'Set the vgplot JSON spec for a dashboard sheet. If sheetId is omitted, updates the current dashboard sheet (or creates one when allowed).',
      inputSchema: DashboardSetVgPlotToolParameters,
      execute: async (params: DashboardSetVgPlotToolParameters) => {
        const state = store.getState();
        let targetSheetId =
          params.sheetId ?? state.dashboard.getCurrentDashboardSheetId();
        if (!targetSheetId && params.createSheetIfMissing) {
          targetSheetId = state.dashboard.createDashboardSheet();
        }
        if (!targetSheetId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard sheet available. Set createSheetIfMissing=true or provide a sheetId.',
            },
          };
        }

        try {
          const vgplotString = toVgPlotSpecString(params.vgplot);
          state.dashboard.setSheetVgPlot(targetSheetId, vgplotString);
          state.cells.setCurrentSheet(targetSheetId);
          return {
            llmResult: {
              success: true,
              details: `Updated dashboard spec for "${targetSheetId}".`,
              data: {
                sheetId: targetSheetId,
                vgplot: state.dashboard.getSheetVgPlot(targetSheetId),
              },
            },
          };
        } catch (error) {
          return {
            llmResult: {
              success: false,
              errorMessage: getErrorMessage(error),
            },
          };
        }
      },
    }),
  };
}
