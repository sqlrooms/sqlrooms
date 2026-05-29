import {
  findTableInSchemaTrees,
  makeQualifiedTableName,
  type DuckDbSliceState,
} from '@sqlrooms/duckdb';
import {getAiRunContextItems, type AiRunContext} from '@sqlrooms/ai-core';
import {tool} from 'ai';
import {z} from 'zod';
import type {StoreApi} from '@sqlrooms/room-shell';

const ReadTableSchemaInput = z.object({
  tableId: z
    .string()
    .optional()
    .describe(
      'Qualified table name (e.g., "database.schema.table"). Defaults to the primary context table if not specified.',
    ),
});

export type ReadTableSchemaParameters = z.infer<typeof ReadTableSchemaInput>;

export type ReadTableSchemaOutput = {
  success: boolean;
  errorMessage?: string;
  table?: {
    id: string;
    name: string;
    database: string | undefined;
    schema: string | undefined;
    isView: boolean;
    rowCount: number | undefined;
    columns: {
      name: string;
      type: string;
    }[];
    createStatement?: string;
  };
};

type TableContextToolExecutionContext = {
  sessionId?: string;
  aiRunContext?: AiRunContext;
  getAiRunContext?: () => AiRunContext | undefined;
};

export function createReadTableSchemaTool(store: StoreApi<DuckDbSliceState>) {
  return tool({
    description:
      'Read the detailed schema of any table in the database. Returns column names, types, row count, and CREATE statement for views.',
    inputSchema: ReadTableSchemaInput,
    execute: async (input, executionOptions) => {
      const state = store.getState();

      // Determine which table to read
      let targetTableId: string;
      if (input.tableId) {
        targetTableId = input.tableId;
      } else {
        // Default to primary context table
        const context = executionOptions as
          | TableContextToolExecutionContext
          | undefined;

        const runContext =
          context?.getAiRunContext?.() ?? context?.aiRunContext;
        const tableItems = getAiRunContextItems(runContext).filter(
          (item) => item.kind === 'table',
        );

        const primaryTable = tableItems[0];
        if (!primaryTable) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No table specified and no primary context table available. Provide a tableId parameter or use list_tables to discover available tables.',
            },
          };
        }
        targetTableId = primaryTable.id;
      }

      // Find the table object in schema trees
      const tableObj = findTableInSchemaTrees(
        state.db.schemaTrees,
        targetTableId,
        makeQualifiedTableName,
      );

      if (!tableObj) {
        return {
          llmResult: {
            success: false,
            errorMessage: `Table "${targetTableId}" not found in database. Use list_tables to see available tables.`,
          },
        };
      }

      return {
        llmResult: {
          success: true,
          table: {
            id: targetTableId,
            name: tableObj.table.table,
            database: tableObj.table.database,
            schema: tableObj.table.schema,
            isView: tableObj.isView,
            rowCount: tableObj.rowCount,
            columns: tableObj.columns.map((col) => ({
              name: col.name,
              type: col.type,
            })),
            ...(tableObj.sql ? {createStatement: tableObj.sql} : {}),
          },
        },
      };
    },
  });
}
