import {
  DuckDbSliceConfig,
  getSqlErrorWithPointer,
  splitSqlStatements,
} from '@sqlrooms/duckdb';
import {
  BaseProjectConfig,
  createSlice,
  ProjectBuilderState,
  type Slice,
  StateCreator,
  useBaseProjectBuilderStore,
} from '@sqlrooms/project-builder';
import {generateUniqueName, genRandomStr} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import {produce} from 'immer';
import {z} from 'zod';

// Saved state (persisted)
export const SqlEditorSliceConfig = z.object({
  sqlEditor: z.object({
    queries: z.array(
      z.object({
        id: z.string().describe('Query identifier.'),
        name: z.string().describe('Query name.'),
        query: z.string().describe('SQL query to execute.'),
      }),
    ),
    selectedQueryId: z
      .string()
      .default('default')
      .describe('The id of the currently selected query.'),
    lastExecutedQuery: z.string().optional().describe('Last executed query'),
  }),
});
export type SqlEditorSliceConfig = z.infer<typeof SqlEditorSliceConfig>;

export function createDefaultSqlEditorConfig(): SqlEditorSliceConfig {
  return {
    sqlEditor: {
      queries: [{id: 'default', name: 'Untitled', query: ''}],
      selectedQueryId: 'default',
    },
  };
}

export type QueryResult =
  | {status: 'loading'}
  | {status: 'error'; error: string}
  | {
      status: 'success';
      isSelect: true;
      resultPreview: arrow.Table | undefined;
      lastQueryStatement: string;
    }
  | {
      status: 'success';
      isSelect: false;
      lastQueryStatement: string;
    };

export type RunQueryOptions = {
  limit?: number;
  skipExecutingLastSelect?: boolean;
};

export type SqlEditorSliceState = {
  sqlEditor: {
    // Runtime state
    queryResult?: QueryResult;
    selectedTable?: string;
    /** @deprecated Use `useStoreWithSqlEditor((s) => s.db.isRefreshingTableSchemas)` instead. */
    isTablesLoading: boolean;
    /** @deprecated */
    tablesError?: string;

    /**
     * Execute a SQL query and return the results.
     * @param query - The SQL query to execute.
     * @deprecated Use `runQuery` instead.
     */
    executeQuery(query: string): Promise<QueryResult>;

    /**
     * Run the currently selected query.
     */
    runQuery(query: string, options?: RunQueryOptions): Promise<QueryResult>;

    /**
     * Run the currently selected query.
     */
    runCurrentQuery(options?: RunQueryOptions): Promise<QueryResult>;

    /**
     * Export query results to CSV.
     * @deprecated Use `useExportToCsv` from `@sqlrooms/duckdb` instead.
     */
    exportResultsToCsv(results: arrow.Table, filename?: string): void;

    /**
     * Create a new query tab.
     * @param initialQuery - Optional initial query text.
     */
    createQueryTab(initialQuery?: string): {
      id: string;
      name: string;
      query: string;
    };

    /**
     * Delete a query tab.
     * @param queryId - The ID of the query to delete.
     */
    deleteQueryTab(queryId: string): void;

    /**
     * Rename a query tab.
     * @param queryId - The ID of the query to rename.
     * @param newName - The new name for the query.
     */
    renameQueryTab(queryId: string, newName: string): void;

    /**
     * Update the SQL text for a query.
     * @param queryId - The ID of the query to update.
     * @param queryText - The new SQL text.
     */
    updateQueryText(queryId: string, queryText: string): void;

    /**
     * Set the selected query tab.
     * @param queryId - The ID of the query to select.
     */
    setSelectedQueryId(queryId: string): void;

    /**
     * Get the currently selected query's SQL text.
     */
    getCurrentQuery(): string;

    selectTable(table: string | undefined): void;

    clearQueryResults(): void;
  };
};

export function createSqlEditorSlice<
  PC extends BaseProjectConfig & DuckDbSliceConfig & SqlEditorSliceConfig,
>(): StateCreator<SqlEditorSliceState> {
  return createSlice<PC, SqlEditorSliceState>((set, get) => ({
    sqlEditor: {
      // Initialize runtime state
      isTablesLoading: false,

      executeQuery: async (query): Promise<QueryResult> =>
        get().sqlEditor.runQuery(query),

      runCurrentQuery: async (options): Promise<QueryResult> =>
        get().sqlEditor.runQuery(get().sqlEditor.getCurrentQuery(), options),

      runQuery: async (query, options): Promise<QueryResult> => {
        const {limit, skipExecutingLastSelect = false} = options || {};
        if (!query.trim()) {
          return {
            status: 'error',
            error: 'Empty query',
          };
        }
        // First update loading state and clear results
        set((state) =>
          produce(state, (draft) => {
            draft.sqlEditor.selectedTable = undefined;
            draft.sqlEditor.queryResult = {status: 'loading'};
            draft.config.sqlEditor.lastExecutedQuery = query;
          }),
        );

        let queryResult: QueryResult;
        try {
          const connector = await get().db.getConnector();

          const statements = splitSqlStatements(query);
          const allButLastStatements = statements.slice(0, -1);
          const lastStatement = statements[statements.length - 1] as string;

          for (const statement of allButLastStatements) {
            await connector.query(statement);
          }

          const parsedLastStatement =
            await get().db.sqlSelectToJson(lastStatement);

          const isValidSelectQuery = !parsedLastStatement.error;
          if (isValidSelectQuery) {
            queryResult = {
              status: 'success',
              lastQueryStatement: lastStatement,
              isSelect: true,
              resultPreview: skipExecutingLastSelect
                ? undefined
                : limit
                  ? await connector.query(
                      `SELECT * FROM (${lastStatement}) LIMIT ${limit}`,
                    )
                  : await connector.query(lastStatement),
            };
          } else {
            if (
              parsedLastStatement.error &&
              parsedLastStatement.error_type !== 'not implemented'
            ) {
              throw (
                `${parsedLastStatement.error_type} ${parsedLastStatement.error_subtype}: ${parsedLastStatement.error_message}` +
                `\n${getSqlErrorWithPointer(lastStatement, Number(parsedLastStatement.position)).formatted}`
              );
            }
            await connector.query(lastStatement);
            queryResult = {
              status: 'success',
              lastQueryStatement: lastStatement,
              isSelect: false,
            };
          }
          // Refresh table schemas if there are multiple statements or if the
          // last statement is not a select query
          if (statements.length > 1 || !isValidSelectQuery) {
            get().db.refreshTableSchemas();
          }
        } catch (e) {
          console.error(e);
          const errorMessage = e instanceof Error ? e.message : String(e);

          queryResult = {
            status: 'error',
            error: errorMessage,
          };
        }

        set((state) => ({
          ...state,
          sqlEditor: {...state.sqlEditor, queryResult},
        }));
        return queryResult;
      },

      exportResultsToCsv: (results, filename) => {
        if (!results) return;
        const blob = new Blob([csvFormat(results.toArray())], {
          type: 'text/plain;charset=utf-8',
        });
        saveAs(blob, filename || `export-${genRandomStr(5)}.csv`);
      },

      createQueryTab: (initialQuery = '') => {
        const sqlEditorConfig = get().config.sqlEditor;
        const newQuery = {
          id: genRandomStr(8),
          name: generateUniqueName(
            'Untitled',
            sqlEditorConfig.queries.map((q) => q.name),
          ),
          query: initialQuery,
        };

        set((state) =>
          produce(state, (draft) => {
            draft.config.sqlEditor.queries.push(newQuery);
            draft.config.sqlEditor.selectedQueryId = newQuery.id;
          }),
        );

        return newQuery;
      },

      deleteQueryTab: (queryId) => {
        const sqlEditorConfig = get().config.sqlEditor;
        const queries = sqlEditorConfig.queries;

        if (queries.length <= 1) {
          // Don't delete the last query
          return;
        }

        const index = queries.findIndex((q) => q.id === queryId);
        if (index === -1) return;

        const isSelected = sqlEditorConfig.selectedQueryId === queryId;
        const filteredQueries = queries.filter((q) => q.id !== queryId);

        set((state) =>
          produce(state, (draft) => {
            draft.config.sqlEditor.queries = filteredQueries;

            // If we're deleting the selected tab, select the previous one or the first one
            if (isSelected && filteredQueries.length > 0) {
              const newSelectedIndex = Math.max(0, index - 1);
              // Safely access the ID with fallback to the first query if needed
              const newSelectedId =
                filteredQueries[newSelectedIndex]?.id ?? filteredQueries[0]?.id;
              if (newSelectedId) {
                draft.config.sqlEditor.selectedQueryId = newSelectedId;
              }
            }
          }),
        );
      },

      renameQueryTab: (queryId, newName) => {
        set((state) =>
          produce(state, (draft) => {
            const query = draft.config.sqlEditor.queries.find(
              (q) => q.id === queryId,
            );
            if (query) {
              query.name = newName || query.name;
            }
          }),
        );
      },

      updateQueryText: (queryId, queryText) => {
        set((state) =>
          produce(state, (draft) => {
            const query = draft.config.sqlEditor.queries.find(
              (q) => q.id === queryId,
            );
            if (query) {
              query.query = queryText;
            }
          }),
        );
      },

      setSelectedQueryId: (queryId) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.sqlEditor.selectedQueryId = queryId;
          }),
        );
      },

      getCurrentQuery: () => {
        const sqlEditorConfig = get().config.sqlEditor;
        const selectedId = sqlEditorConfig.selectedQueryId;
        const query = sqlEditorConfig.queries.find((q) => q.id === selectedId);
        return query?.query || '';
      },

      selectTable: (table) => {
        set((state) =>
          produce(state, (draft) => {
            draft.sqlEditor.selectedTable = table;
          }),
        );
      },

      clearQueryResults: () => {
        // Update state without using Immer for the Table type
        set((state) => ({
          ...state,
          sqlEditor: {
            ...state.sqlEditor,
            queryResults: null,
            queryError: undefined,
          },
        }));
      },
    },
  }));
}

type ProjectConfigWithSqlEditor = BaseProjectConfig & SqlEditorSliceConfig;
type ProjectStateWithSqlEditor =
  ProjectBuilderState<ProjectConfigWithSqlEditor> & SqlEditorSliceState;

export function useStoreWithSqlEditor<T>(
  selector: (state: ProjectStateWithSqlEditor) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig & SqlEditorSliceConfig,
    ProjectBuilderState<ProjectConfigWithSqlEditor>,
    T
  >((state) => selector(state as unknown as ProjectStateWithSqlEditor));
}
