import {tool} from 'ai';
import {z} from 'zod';
import type {MosaicDashboardPanelConfig} from '../../dashboard/dashboard-types';
import type {ChartRuntimeIssue} from '../../chart-runtime';
import type {ToolOutput} from '../tool-types';
import type {DashboardAiAdapter} from './dashboard-types';

const ListDashboardPanelsToolInput = z.object({
  reasoning: z
    .string()
    .optional()
    .describe('Brief rationale for inspecting dashboard panels.'),
});

type ListDashboardPanelsToolInput = z.infer<
  typeof ListDashboardPanelsToolInput
>;

type DashboardPanelSummary = {
  id: string;
  type: string;
  title: string;
  config: MosaicDashboardPanelConfig['config'];
  issue?: ChartRuntimeIssue;
};

type ListDashboardPanelsToolOutput = ToolOutput<{
  selectedTable?: string;
  panels?: DashboardPanelSummary[];
}>;

export type CreateListDashboardPanelsToolOptions = {
  /** Adapter for dashboard operations */
  dashboardAdapter: DashboardAiAdapter;
};

function summarizePanel(
  panel: MosaicDashboardPanelConfig,
  getPanelIssue?: DashboardAiAdapter['getPanelIssue'],
): DashboardPanelSummary {
  const issue = getPanelIssue?.(panel.id);

  return {
    id: panel.id,
    type: panel.type,
    title: panel.title,
    config: panel.config,
    ...(issue !== undefined ? {issue} : {}),
  };
}

/**
 * Creates a tool for inspecting the current dashboard's selected table,
 * panels, and panel runtime issues.
 */
export function createListDashboardPanelsTool({
  dashboardAdapter,
}: CreateListDashboardPanelsToolOptions) {
  return tool<ListDashboardPanelsToolInput, ListDashboardPanelsToolOutput>({
    description: `List panels in the current dashboard, including the selected table and any panel runtime issues.

Use this before updating existing dashboard panels, when deciding which table the dashboard currently targets, and after creating map panels to check for render issues.`,
    inputSchema: ListDashboardPanelsToolInput,
    execute: async () => {
      try {
        const panels = dashboardAdapter.getPanels?.();

        if (!panels) {
          return {
            success: false,
            errorMessage: 'Dashboard adapter does not support listing panels.',
          };
        }

        const selectedTable = dashboardAdapter.getSelectedTable?.();

        return {
          success: true,
          ...(selectedTable !== undefined ? {selectedTable} : {}),
          panels: panels.map((panel) =>
            summarizePanel(panel, dashboardAdapter.getPanelIssue),
          ),
        };
      } catch (error) {
        return {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
