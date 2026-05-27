import {getAiRunContextItems, type AiRunContext} from '@sqlrooms/ai';
import {findTableInSchemaTrees, makeQualifiedTableName} from '@sqlrooms/duckdb';
import {tool} from 'ai';
import {z} from 'zod';
import type {RoomState} from '../store-types';
import type {StoreApi} from 'zustand';

const ListContextTablesInput = z.object({});
type ListContextTablesInput = z.infer<typeof ListContextTablesInput>;

type TableContextToolExecutionContext = {
  sessionId?: string;
  aiRunContext?: AiRunContext;
  getAiRunContext?: () => AiRunContext | undefined;
};

export function createListContextTablesTool(store: StoreApi<RoomState>) {
  return tool({
    description:
      'List all tables currently in the AI context. Use this to see which tables are available for queries.',
    inputSchema: ListContextTablesInput,
    execute: async (_input, executionOptions) => {
      const context = executionOptions as TableContextToolExecutionContext;

      const runContext = context?.getAiRunContext?.() ?? context.aiRunContext;
      const tableItems = getAiRunContextItems(runContext).filter(
        (item) => item.kind === 'table',
      );

      if (tableItems.length === 0) {
        return {
          llmResult: {
            success: true,
            tables: [],
            message: 'No tables in context.',
          },
        };
      }

      const state = store.getState();
      const tables = tableItems.map((item) => {
        const tableObj = findTableInSchemaTrees(
          state.db.schemaTrees,
          item.id,
          makeQualifiedTableName,
        );

        return {
          id: item.id,
          title: item.title,
          type: item.type ?? 'table',
          subtitle: item.subtitle,
          database: tableObj?.table.database,
          schema: tableObj?.table.schema,
          columnCount: tableObj?.columns.length ?? 0,
          rowCount: tableObj?.rowCount,
        };
      });

      return {
        llmResult: {
          success: true,
          tables,
        },
      };
    },
  });
}
