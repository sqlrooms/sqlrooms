import {tool} from 'ai';
import {z} from 'zod';
import {ensureTable} from './tool-helpers';
import {DatabaseAiAdapter} from './database-types';

/**
 * Parameters for creating a Data Table Explorer panel.
 */
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
});

/**
 * Inferred type for Data Table Explorer parameters.
 */
export type DataTableExplorerParameters = z.infer<
  typeof DataTableExplorerParameters
>;

/**
 * Tool input schema including reasoning and explorer parameters.
 */
export const DataTableExplorerToolInput = z.object({
  reasoning: z
    .string()
    .describe('Brief rationale for creating the Data Table Explorer.'),
  ...DataTableExplorerParameters.shape,
});

/**
 * Inferred type for Data Table Explorer tool input.
 */
export type DataTableExplorerToolInput = z.infer<
  typeof DataTableExplorerToolInput
>;

/**
 * Options for creating the Data Table Explorer tool.
 */
export type CreateDataTableExplorerToolOptions = {
  databaseAdapter: DatabaseAiAdapter;
  addDataTable(params: DataTableExplorerParameters): void;
};

/**
 * Creates an AI tool for generating Data Table Explorer panels with schema and column statistics.
 */
export function createDataTableExplorerTool({
  databaseAdapter,
  addDataTable,
}: CreateDataTableExplorerToolOptions) {
  return tool({
    description: `Data Table Explorer: displays table schema and statistics for all columns (count, distinct values, min/max, etc.).

Use when: user asks to "profile the data", "show table statistics", "what's in this table", "summarize columns", "give me an overview of the data".

Useful for: quick data exploration, understanding data quality, finding missing values, identifying column types.`,
    inputSchema: DataTableExplorerToolInput,
    execute: async (params) => {
      try {
        if (params.tableName) {
          ensureTable(databaseAdapter, params.tableName);
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
