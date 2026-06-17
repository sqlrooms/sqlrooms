import {tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from '../charts/chart-types/base-types';

export const RemovePanelToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
  panelId: z
    .string()
    .describe(
      'ID of the panel to remove. Use list_dashboard_panels to discover panel IDs.',
    ),
  reasoning: z.string().describe('Brief rationale for removing this panel.'),
});

export type RemovePanelToolParams = z.infer<typeof RemovePanelToolParameters>;

export function createRemovePanelTool(deps: DashboardToolDeps) {
  return tool({
    description: `Remove dashboard panel: deletes a panel from the dashboard by its ID.

Use when: user asks to "remove", "delete", "get rid of" a specific panel.

Use list_dashboard_panels first to discover panel IDs.`,
    inputSchema: RemovePanelToolParameters,
    execute: async (params) => {
      try {
        const artifactId = deps.resolveArtifact(params.artifactId);
        const dashboard = deps.getDashboard(artifactId);
        if (!dashboard) {
          throw new Error(`Dashboard "${artifactId}" not found.`);
        }
        const panelExists = dashboard.panels.some(
          (panel: {id: string}) => panel.id === params.panelId,
        );
        if (!panelExists) {
          throw new Error(
            `Panel "${params.panelId}" not found in dashboard "${artifactId}". Cannot remove.`,
          );
        }

        deps.removePanel(artifactId, params.panelId);

        return {
          llmResult: {
            success: true,
            details: `Removed panel "${params.panelId}" from dashboard.`,
            data: {
              artifactId,
              panelId: params.panelId,
            },
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  });
}
