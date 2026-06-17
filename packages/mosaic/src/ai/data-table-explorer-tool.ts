import {tool} from 'ai';
import {z} from 'zod';
import type {DashboardToolDeps} from '../charts/chart-types/base-types';
import {createOrUpdateDataTableExplorerPanel} from './tool-helpers';
import {DataTableExplorerPanelConfig} from '../dashboard/core-types';

export const DataTableExplorerToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe('Optional dashboard artifact ID. Defaults to current dashboard.'),
  tableName: z
    .string()
    .optional()
    .describe('Optional table name. Use when no table is selected yet.'),
  createArtifactIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe('If true, create dashboard artifact if missing.'),
  panelId: z
    .string()
    .optional()
    .describe(
      'Optional panel ID. If provided, updates the existing panel instead of creating new one.',
    ),
  title: z
    .string()
    .optional()
    .default('Data Table Explorer')
    .describe('Title for the Data Table Explorer panel.'),
  config: DataTableExplorerPanelConfig,
  reasoning: z
    .string()
    .describe('Brief rationale for creating the Data Table Explorer.'),
});

export type DataTableExplorerToolParams = z.infer<
  typeof DataTableExplorerToolParameters
>;

export function createDataTableExplorerTool(deps: DashboardToolDeps) {
  return tool({
    description: `Data Table Explorer: displays table schema and statistics for all columns (count, distinct values, min/max, etc.).

Use when: user asks to "profile the data", "show table statistics", "what's in this table", "summarize columns", "give me an overview of the data".

Useful for: quick data exploration, understanding data quality, finding missing values, identifying column types.

To UPDATE an existing Data Table Explorer: provide the panelId parameter. Otherwise creates new panel.`,
    inputSchema: DataTableExplorerToolParameters,
    execute: async (params) => {
      try {
        const artifactId = deps.resolveArtifact(
          params.artifactId,
          params.createArtifactIfMissing,
        );
        const {tableName} = deps.resolveTable(artifactId, params.tableName);

        const result = createOrUpdateDataTableExplorerPanel(deps, {
          panelId: params.panelId,
          dashboardId: artifactId,
          tableName,
          title: params.title || 'Data Table Explorer',
          config: params.config,
        });

        return {
          llmResult: {
            success: true,
            details: params.panelId
              ? `Updated Data Table Explorer "${result.title}".`
              : `Created Data Table Explorer "${result.title}".`,
            data: result,
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
