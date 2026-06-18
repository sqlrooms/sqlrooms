import {tool} from 'ai';
import {z} from 'zod';
import {ensureTable} from './tool-helpers';
import {DataTableExplorerPanelConfig} from '../dashboard/core-types';
import {DashboardAiAdapter} from './types';

export const DataTableExplorerParameters = z.object({
  tableName: z
    .string()
    .optional()
    .describe('Optional table name. Use when no table is selected yet.'),
  title: z
    .string()
    .optional()
    .default('Data Table Explorer')
    .describe('Title for the Data Table Explorer panel.'),
  config: DataTableExplorerPanelConfig,
});

export type DataTableExplorerParameters = z.infer<
  typeof DataTableExplorerParameters
>;

export const DataTableExplorerToolParameters = z.object({
  reasoning: z
    .string()
    .describe('Brief rationale for creating the Data Table Explorer.'),
  ...DataTableExplorerParameters.shape,
});

export type DataTableExplorerToolParameters = z.infer<
  typeof DataTableExplorerToolParameters
>;

export type CreateDataTableExplorerToolOptions = {
  adapter: DashboardAiAdapter;
  addDataTable(params: DataTableExplorerParameters): void;
};

export function createDataTableExplorerTool({
  adapter,
  addDataTable,
}: CreateDataTableExplorerToolOptions) {
  return tool({
    description: `Data Table Explorer: displays table schema and statistics for all columns (count, distinct values, min/max, etc.).

Use when: user asks to "profile the data", "show table statistics", "what's in this table", "summarize columns", "give me an overview of the data".

Useful for: quick data exploration, understanding data quality, finding missing values, identifying column types.`,
    inputSchema: DataTableExplorerToolParameters,
    execute: async (params) => {
      try {
        if (params.tableName) {
          ensureTable(adapter, params.tableName);
        }

        addDataTable(params);

        return {
          llmResult: {
            success: true,
            details: `Created Data Table Explorer "${params.title}".`,
            data: params,
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
