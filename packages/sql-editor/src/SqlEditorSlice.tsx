import {createId} from '@paralleldrive/cuid2';
import type {DbSliceState} from '@sqlrooms/db';
import {
  DuckDbSliceState,
  getSqlErrorWithPointer,
  joinStatements,
  makeLimitQuery,
  separateLastStatement,
} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  RoomShellSliceState,
  StateCreator,
  useBaseRoomShellStore,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  SqlEditorSliceConfig,
} from '@sqlrooms/sql-editor-config';
import {generateUniqueName} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import {produce} from 'immer';

export type QueryResult =
  | {status: 'loading'; isBeingAborted?: boolean; controller: AbortController}
  | {status: 'aborted'}
  | {status: 'error'; error: string}
  | {
      status: 'success';
      type: 'pragma' | 'explain' | 'select';
      result: arrow.Table | undefined;
      query: string;
      lastQueryStatement: string;
    }
  | {
      status: 'success';
      type: 'exec';
      query: string;
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
    /**
     * Query results keyed by queryId (tab id).
     */
    queryResultsById: Record<string, QueryResult | undefined>;
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
     * Set the config for the sql editor slice.
     */
    setConfig(config: SqlEditorSliceConfig): void;

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
     * @param queryId - The ID of the query to open.
     */
    openQueryTab(queryId: string): void;

    /**
     * Set the list of open tab IDs. Used for reordering or opening tabs.
     * @param tabIds - The new list of open tab IDs.
     */
    setOpenTabs(tabIds: string[]): void;

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
  return createSlice<
    SqlEditorSliceState,
    BaseRoomStoreState & DuckDbSliceState & DbSliceState & SqlEditorSliceState
  >((set, get) => {
    return {
      sqlEditor: {
        config,
        // Initialize runtime state
        queryResultsById: {},
        isTablesLoading: false,
        queryResultLimit,
        queryResultLimitOptions,

        setConfig: (config) => {
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config = config;
            }),
          );
        },

        exportResultsToCsv: (results, filename) => {
          if (!results) return;
          const blob = new Blob([csvFormat(results.toArray())], {
            type: 'text/plain;charset=utf-8',
          });
          saveAs(blob, filename || `export-${createId().substring(0, 5)}.csv`);
        },

        createQueryTab: (initialQuery = '') => {
          const sqlEditorConfig = get().sqlEditor.config;
          const now = Date.now();
          const newQuery = {
            id: createId(),
            name: generateUniqueName(
              'Untitled 1',
              sqlEditorConfig.queries.map((q) => q.name),
              ' ',
            ),
            query: initialQuery,
            lastOpenedAt: now,
          };

          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config.queries.push(newQuery);
              draft.sqlEditor.config.openTabs.push(newQuery.id);
              draft.sqlEditor.config.selectedQueryId = newQuery.id;
            }),
          );

          return newQuery;
        },

        deleteQueryTab: (queryId) => {
          const sqlEditorConfig = get().sqlEditor.config;
          const queries = sqlEditorConfig.queries;
          const openTabs = sqlEditorConfig.openTabs;

          if (queries.length <= 1) {
            // Don't delete the last query
            return;
          }

          const wasSelected = sqlEditorConfig.selectedQueryId === queryId;
          const deletingOpenIndex = openTabs.indexOf(queryId);
          const filteredQueries = queries.filter((q) => q.id !== queryId);

          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config.queries = filteredQueries;
              draft.sqlEditor.config.openTabs = openTabs.filter(
                (id) => id !== queryId,
              );
              const {[queryId]: _removed, ...rest} =
                draft.sqlEditor.queryResultsById;
              draft.sqlEditor.queryResultsById = rest;

              // If we deleted the selected query, select another one
              if (wasSelected) {
                const newOpenTabs = draft.sqlEditor.config.openTabs;
                const remainingQueries = draft.sqlEditor.config.queries;

                if (newOpenTabs.length > 0) {
                  // Select from remaining open tabs
                  const newIndex =
                    deletingOpenIndex === 0
                      ? 0
                      : Math.min(deletingOpenIndex - 1, newOpenTabs.length - 1);
                  const newSelectedId = newOpenTabs[newIndex];
                  if (newSelectedId) {
                    draft.sqlEditor.config.selectedQueryId = newSelectedId;
                    const newSelectedQuery =
                      draft.sqlEditor.config.queries.find(
                        (q) => q.id === newSelectedId,
                      );
                    if (newSelectedQuery) {
                      newSelectedQuery.lastOpenedAt = Date.now();
                    }
                  }
                } else if (remainingQueries.length > 0) {
                  // No open tabs left, open a closed query
                  const queryToOpen = remainingQueries[0];
                  if (queryToOpen) {
                    draft.sqlEditor.config.openTabs.push(queryToOpen.id);
                    draft.sqlEditor.config.selectedQueryId = queryToOpen.id;
                    queryToOpen.lastOpenedAt = Date.now();
                  }
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
              draft.sqlEditor.config.openTabs =
                draft.sqlEditor.config.openTabs.filter((id) => id !== queryId);
            }),
          );
        },

        openQueryTab: (queryId) => {
          set((state) =>
            produce(state, (draft) => {
              if (!draft.sqlEditor.config.openTabs.includes(queryId)) {
                draft.sqlEditor.config.openTabs.push(queryId);
              }
              draft.sqlEditor.config.selectedQueryId = queryId;
              const query = draft.sqlEditor.config.queries.find(
                (q) => q.id === queryId,
              );
              if (query) {
                query.lastOpenedAt = Date.now();
              }
            }),
          );
        },

        setOpenTabs: (tabIds) => {
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.config.openTabs = tabIds;
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
              const query = draft.sqlEditor.config.queries.find(
                (q) => q.id === queryId,
              );
              if (query) {
                query.lastOpenedAt = Date.now();
              }
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
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.queryResultsById = {};
            }),
          );
        },

        parseAndRunCurrentQuery: async (): Promise<void> =>
          get().sqlEditor.parseAndRunQuery(get().sqlEditor.getCurrentQuery()),

        abortCurrentQuery: () => {
          const selectedQueryId = get().sqlEditor.config.selectedQueryId;
          const currentResult =
            get().sqlEditor.queryResultsById[selectedQueryId];
          if (currentResult?.status === 'loading' && currentResult.controller) {
            currentResult.controller.abort();
          }

          set((state) =>
            produce(state, (draft) => {
              const result = draft.sqlEditor.queryResultsById[selectedQueryId];
              if (result?.status === 'loading') {
                result.isBeingAborted = true;
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
          const selectedQueryId = get().sqlEditor.config.selectedQueryId;
          const existingResult =
            get().sqlEditor.queryResultsById[selectedQueryId];
          if (existingResult?.status === 'loading') {
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
              draft.sqlEditor.queryResultsById[selectedQueryId] = {
                status: 'loading',
                isBeingAborted: false,
                controller: queryController,
              };
            }),
          );

          let queryResult: QueryResult;
          try {
            const dbx = get().dbx;
            const connector = await get().db.getConnector();
            const signal = queryController.signal;

            const {precedingStatements, lastStatement: lastQueryStatement} =
              separateLastStatement(query);
            const hasMultipleStatements = precedingStatements.length > 0;

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
              const limitedLastStatement = makeLimitQuery(lastQueryStatement, {
                sanitize: false, // should already be sanitized
                limit: get().sqlEditor.queryResultLimit,
              });
              const queryWithLimit = joinStatements(
                precedingStatements,
                limitedLastStatement,
              );
              const result = dbx?.runQuery
                ? (
                    await dbx.runQuery({
                      sql: queryWithLimit,
                      queryType: 'arrow',
                      signal,
                    })
                  )?.arrowTable
                : await connector.query(queryWithLimit, {signal});
              queryResult = {
                status: 'success',
                type: 'select',
                query,
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

              const result = dbx?.runQuery
                ? (
                    await dbx.runQuery({
                      sql: query,
                      queryType: /^(EXPLAIN|PRAGMA)/i.test(lastQueryStatement)
                        ? 'arrow'
                        : 'exec',
                      signal,
                    })
                  )?.arrowTable
                : await connector.query(query, {signal});
              // EXPLAIN and PRAGMA are not detected as select queries
              // and we cannot wrap them in a SELECT * FROM,
              // but we can still execute them and return the result
              if (/^(EXPLAIN)/i.test(lastQueryStatement)) {
                queryResult = {
                  status: 'success',
                  type: 'explain',
                  query,
                  lastQueryStatement,
                  result,
                };
              } else if (/^(PRAGMA)/i.test(lastQueryStatement)) {
                queryResult = {
                  status: 'success',
                  type: 'pragma',
                  query,
                  lastQueryStatement,
                  result,
                };
              } else {
                queryResult = {
                  status: 'success',
                  type: 'exec',
                  query,
                  lastQueryStatement,
                };
              }
            }
            if (signal.aborted) {
              throw new Error('Query aborted');
            }
            // Refresh table schemas if there are multiple statements or if the
            // last statement is not a select query
            if (hasMultipleStatements || !isValidSelectQuery) {
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

          // Update state without Immer since Arrow Tables don't play well with drafts.
          set((state) => ({
            ...state,
            sqlEditor: {
              ...state.sqlEditor,
              queryResultsById: {
                ...state.sqlEditor.queryResultsById,
                [selectedQueryId]: queryResult,
              },
            },
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
