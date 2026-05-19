import {tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from './base-types';

export const ListPanelsToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
  reasoning: z
    .string()
    .describe('Brief rationale for listing dashboard panels.'),
});

export type ListPanelsToolParams = z.infer<typeof ListPanelsToolParameters>;

export function createListPanelsTool(deps: DashboardToolDeps) {
  return tool({
    description: `List dashboard panels: returns all panels in the current dashboard with their IDs, types, titles, and configurations.

Use when: you need to discover panel IDs before updating or removing panels, or when user asks "what's on this dashboard".

Returns array of: {id, type, title, config} for each panel.`,
    inputSchema: ListPanelsToolParameters,
    execute: async (params) => {
      try {
        const {artifactId} = deps.resolveResources(params);

        const dashboard = deps.getDashboard(artifactId);
        if (!dashboard) {
          return {
            llmResult: {
              success: false,
              errorMessage: `Dashboard "${artifactId}" not found.`,
            },
          };
        }

        const panels = dashboard.panels.map((panel: any) => ({
          id: panel.id,
          type: panel.type,
          title: panel.title,
          config: panel.config,
        }));

        return {
          llmResult: {
            success: true,
            details: `Found ${panels.length} panel(s) in dashboard.`,
            data: {
              artifactId,
              panels,
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
