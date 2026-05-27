import {getAiRunContextItems, type AiRunContext} from '@sqlrooms/ai';
import {findTableInSchemaTrees, makeQualifiedTableName} from '@sqlrooms/duckdb';
import {tool} from 'ai';
import {z} from 'zod';
import type {RoomState} from '../store-types';
import type {StoreApi} from 'zustand';

const ReadTableSchemaInput = z.object({
  tableId: z
    .string()
    .optional()
    .describe(
      'Qualified table name (e.g., "database.schema.table"). Defaults to the primary context table if not specified.',
    ),
});

type TableContextToolExecutionContext = {
  sessionId?: string;
  aiRunContext?: AiRunContext;
  getAiRunContext?: () => AiRunContext | undefined;
};

export function createReadTableSchemaTool(store: StoreApi<RoomState>) {
  return tool({
    description:
      'Read the schema of a table in the AI context. Returns column names, types, row count, and CREATE statement for views.',
    inputSchema: ReadTableSchemaInput,
    execute: async (input, executionOptions) => {
      const context = executionOptions as
        | TableContextToolExecutionContext
        | undefined;
      const runContext = context?.getAiRunContext?.() ?? context?.aiRunContext;
      const tableItems = getAiRunContextItems(runContext).filter(
        (item) => item.kind === 'table',
      );

      if (tableItems.length === 0) {
        return {
          llmResult: {
            success: false,
            errorMessage: 'No tables in context.',
          },
        };
      }

      // Determine which table to read
      let targetTableId: string;
      if (input.tableId) {
        targetTableId = input.tableId;
      } else {
        // Default to primary context table
        const primaryTable = tableItems[0];
        if (!primaryTable) {
          return {
            llmResult: {
              success: false,
              errorMessage: 'No tables in context.',
            },
          };
        }
        targetTableId = primaryTable.id;
      }

      // Check if the table is in context
      const isInContext = tableItems.some((item) => item.id === targetTableId);
      if (!isInContext) {
        return {
          llmResult: {
            success: false,
            errorMessage: `Table "${targetTableId}" is not in the current context. Use list_context_tables to see available tables.`,
          },
        };
      }

      // Find the table object
      const state = store.getState();
      const tableObj = findTableInSchemaTrees(
        state.db.schemaTrees,
        targetTableId,
        makeQualifiedTableName,
      );

      if (!tableObj) {
        return {
          llmResult: {
            success: false,
            errorMessage: `Table "${targetTableId}" not found in schema tree.`,
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
