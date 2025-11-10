import {
  getSqlErrorWithPointer,
  splitSqlStatements,
  makeLimitQuery,
} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
  StateCreator,
  useBaseRoomShellStore,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  SqlEditorSliceConfig,
} from '@sqlrooms/sql-editor-config';
import {generateUniqueName, genRandomStr} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import {produce} from 'immer';
import {createId} from '@paralleldrive/cuid2';

export type QueryResult =
  | {status: 'loading'; isBeingAborted?: boolean; controller: AbortController}
  | {status: 'aborted'}
  | {status: 'error'; error: string}
  | {
      status: 'success';
      type: 'pragma' | 'explain' | 'select';
      result: arrow.Table | undefined;
      lastQueryStatement: string;
    }
  | {
      status: 'success';
      type: 'exec';
      lastQueryStatement: string;
    };

export function isQueryWithResult(
  queryResult: QueryResult | undefined,
): queryResult is QueryResult & {
  status: 'success';
  type: 'pragma' | 'explain' | 'select';
} {
  return (
    queryResult?.status === 'success' &&
    (queryResult.type === 'pragma' ||
      queryResult.type === 'explain' ||
      queryResult.type === 'select')
  );
}

export type SqlEditorSliceState = {
  sqlEditor: {
    config: SqlEditorSliceConfig;
    // Runtime state
    queryResult?: QueryResult;
    /** @deprecated  */
    selectedTable?: string;
    /** @deprecated Use `useStoreWithSqlEditor((s) => s.db.isRefreshingTableSchemas)` instead. */
    isTablesLoading: boolean;
    /** @deprecated */
    tablesError?: string;

    queryResultLimit: number;
    /** Options for the result limit dropdown */
    queryResultLimitOptions: number[];

    /**
     * Run the currently selected query.
     */
    parseAndRunQuery(query: string): Promise<void>;

    /**
     * Run the currently selected query.
     */
    parseAndRunCurrentQuery(): Promise<void>;

    /**
     * Abort the currently running query.
     */
    abortCurrentQuery(): void;

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
     * Close a query tab.
     * @param queryId - The ID of the query to close.
     */
    closeQueryTab(queryId: string): void;
    /**
     * Open a closed tab id.
     * @param queryId - The ID of the query to remove.
     */
    openQueryTab(queryId: string): void;

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

    /** @deprecated */
    selectTable(table: string | undefined): void;

    clearQueryResults(): void;

    setQueryResultLimit(limit: number): void;
  };
};

export function createSqlEditorSlice({
  config = createDefaultSqlEditorConfig(),
  queryResultLimit = 100,
  queryResultLimitOptions = [100, 500, 1000],
}: {
  config?: SqlEditorSliceConfig;
  queryResultLimit?: number;
  queryResultLimitOptions?: number[];
} = {}): StateCreator<SqlEditorSliceState> {
  return createSlice<SqlEditorSliceState>((set, get) => {
    return {
      sqlEditor: {
        config,
        // Initialize runtime state
        isTablesLoading: false,
        queryResultLimit,
        queryResultLimitOptions,

        exportResultsToCsv: (results, filename) => {
          if (!results) return;
          const blob = new Blob([csvFormat(results.toArray())], {
            type: 'text/plain;charset=utf-8',
          });
          saveAs(blob, filename || `export-${createId().substring(0, 5)}.csv`);
        },

        createQueryTab: (initialQuery = '') => {
          const sqlEditorConfig = get().sqlEditor.config;
          const newQuery = {
            id: createId(),
            name: generateUniqueName(
              'Untitled',
              sqlEditorConfig.queries.map((q) => q.name),
            ),
            query: initialQuery,
          };

          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config.queries.push(newQuery);
              draft.sqlEditor.config.selectedQueryId = newQuery.id;
            }),
          );

          return newQuery;
        },

        deleteQueryTab: (queryId) => {
          const sqlEditorConfig = get().sqlEditor.config;
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
              draft.sqlEditor.config.queries = filteredQueries;

              // If we're deleting the selected tab, select the previous one or the first one
              if (isSelected && filteredQueries.length > 0) {
                const newSelectedIndex = Math.max(0, index - 1);
                // Safely access the ID with fallback to the first query if needed
                const newSelectedId =
                  filteredQueries[newSelectedIndex]?.id ??
                  filteredQueries[0]?.id;
                if (newSelectedId) {
                  draft.sqlEditor.config.selectedQueryId = newSelectedId;
                }
              }
            }),
          );
        },

        renameQueryTab: (queryId, newName) => {
          set((state) =>
            produce(state, (draft) => {
              const query = draft.sqlEditor.config.queries.find(
                (q) => q.id === queryId,
              );
              if (query) {
                query.name = newName || query.name;
              }
            }),
          );
        },

        closeQueryTab: (queryId) => {
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config.closedTabIds.push(queryId);
              const openedTabs = draft.sqlEditor.config.queries.filter(
                (q) => !draft.sqlEditor.config.closedTabIds.includes(q.id),
              );

              if (
                draft.sqlEditor.config.selectedQueryId === queryId &&
                openedTabs.length > 0 &&
                openedTabs[0]
              ) {
                draft.sqlEditor.config.selectedQueryId = openedTabs[0].id;
              }
            }),
          );
        },

        openQueryTab: (queryId) => {
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config.closedTabIds =
                draft.sqlEditor.config.closedTabIds?.filter(
                  (id) => id !== queryId,
                );
              draft.sqlEditor.config.selectedQueryId = queryId;
            }),
          );
        },

        updateQueryText: (queryId, queryText) => {
          set((state) =>
            produce(state, (draft) => {
              const query = draft.sqlEditor.config.queries.find(
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
              draft.sqlEditor.config.selectedQueryId = queryId;
            }),
          );
        },

        getCurrentQuery: () => {
          const sqlEditorConfig = get().sqlEditor.config;
          const selectedId = sqlEditorConfig.selectedQueryId;
          const query = sqlEditorConfig.queries.find(
            (q) => q.id === selectedId,
          );
          return query?.query || '';
        },

        /** @deprecated */
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

        parseAndRunCurrentQuery: async (): Promise<void> =>
          get().sqlEditor.parseAndRunQuery(get().sqlEditor.getCurrentQuery()),

        abortCurrentQuery: () => {
          const currentResult = get().sqlEditor.queryResult;
          if (currentResult?.status === 'loading' && currentResult.controller) {
            currentResult.controller.abort();
          }

          set((state) =>
            produce(state, (draft) => {
              if (draft.sqlEditor.queryResult?.status === 'loading') {
                draft.sqlEditor.queryResult.isBeingAborted = true;
              }
            }),
          );
        },

        setQueryResultLimit: (limit) => {
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.queryResultLimit = limit;
            }),
          );
        },

        parseAndRunQuery: async (query): Promise<void> => {
          if (get().sqlEditor.queryResult?.status === 'loading') {
            throw new Error('Query already running');
          }
          if (!query.trim()) {
            return;
          }

          // Create abort controller for this query execution
          const queryController = new AbortController();

          // First update loading state and clear results
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.selectedTable = undefined;
              draft.sqlEditor.queryResult = {
                status: 'loading',
                isBeingAborted: false,
                controller: queryController,
              };
            }),
          );

          let queryResult: QueryResult;
          try {
            const connector = await get().db.getConnector();
            const signal = queryController.signal;

            const statements = splitSqlStatements(query);
            const allButLastStatements = statements.slice(0, -1);
            const lastQueryStatement = statements[
              statements.length - 1
            ] as string;

            if (!statements?.length) {
              throw new Error('Empty query');
            }

            if (signal.aborted) {
              throw new Error('Query aborted');
            }

            const parsedLastStatement =
              await get().db.sqlSelectToJson(lastQueryStatement);

            if (signal.aborted) {
              throw new Error('Query aborted');
            }

            const isValidSelectQuery = !parsedLastStatement.error;

            if (isValidSelectQuery) {
              // Add limit to the last statement
              const queryWithLimit = [
                ...allButLastStatements,
                makeLimitQuery(lastQueryStatement, {
                  sanitize: false, // should already be sanitized
                  limit: get().sqlEditor.queryResultLimit,
                }),
              ].join(';\n');
              const result = await connector.query(queryWithLimit, {signal});
              queryResult = {
                status: 'success',
                type: 'select',
                lastQueryStatement,
                result,
              };
            } else {
              // Run the complete query as it is
              if (
                parsedLastStatement.error &&
                parsedLastStatement.error_type !== 'not implemented'
              ) {
                throw (
                  `${parsedLastStatement.error_type} ${parsedLastStatement.error_subtype}: ${parsedLastStatement.error_message}` +
                  `\n${getSqlErrorWithPointer(lastQueryStatement, Number(parsedLastStatement.position)).formatted}`
                );
              }

              const result = await connector.query(query, {signal});
              // EXPLAIN and PRAGMA are not detected as select queries
              // and we cannot wrap them in a SELECT * FROM,
              // but we can still execute them and return the result
              if (/^(EXPLAIN)/i.test(lastQueryStatement)) {
                queryResult = {
                  status: 'success',
                  type: 'explain',
                  lastQueryStatement,
                  result,
                };
              } else if (/^(PRAGMA)/i.test(lastQueryStatement)) {
                queryResult = {
                  status: 'success',
                  type: 'pragma',
                  lastQueryStatement,
                  result,
                };
              } else {
                queryResult = {
                  status: 'success',
                  type: 'exec',
                  lastQueryStatement,
                };
              }
            }
            if (signal.aborted) {
              throw new Error('Query aborted');
            }
            // Refresh table schemas if there are multiple statements or if the
            // last statement is not a select query
            if (statements.length > 1 || !isValidSelectQuery) {
              get().db.refreshTableSchemas();
            }
            if (signal.aborted) {
              throw new Error('Query aborted');
            }
          } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            if (
              errorMessage === 'Query aborted' ||
              queryController.signal.aborted
            ) {
              queryResult = {status: 'aborted'};
            } else {
              queryResult = {
                status: 'error',
                error: errorMessage,
              };
            }
          }

          set((state) => ({
            ...state,
            sqlEditor: {...state.sqlEditor, queryResult},
          }));
        },
      },
    } satisfies SqlEditorSliceState;
  });
}

type RoomStateWithSqlEditor = RoomShellSliceState & SqlEditorSliceState;

export function useStoreWithSqlEditor<T>(
  selector: (state: RoomStateWithSqlEditor) => T,
): T {
  return useBaseRoomShellStore<RoomShellSliceState, T>((state) =>
    selector(state as unknown as RoomStateWithSqlEditor),
  );
}
