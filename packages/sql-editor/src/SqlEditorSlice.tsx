import {createId} from '@paralleldrive/cuid2';
import type {DbSliceState} from '@sqlrooms/db';
import {
  getSqlErrorWithPointer,
  joinStatements,
  makeLimitQuery,
  separateLastStatement,
} from '@sqlrooms/db';
import {
  BaseRoomStoreState,
  createSlice,
  registerCommandsForOwner,
  RoomCommand,
  RoomShellSliceState,
  StateCreator,
  unregisterCommandsForOwner,
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
import {z} from 'zod';

const SQL_EDITOR_COMMAND_OWNER = '@sqlrooms/sql-editor';

export type SqlEditorQuery = SqlEditorSliceConfig['queries'][number];

export type EnsureSqlQueryOptions = {
  name?: string;
  query?: string;
  open?: boolean;
  select?: boolean;
};

export type QueryResult =
  | {
      status: 'loading';
      isBeingAborted?: boolean;
      controller: AbortController;
      startedAt?: number;
    }
  | {status: 'aborted'; durationMs?: number; completedAt?: number}
  | {status: 'error'; error: string; durationMs?: number; completedAt?: number}
  | {
      status: 'success';
      type: 'pragma' | 'explain' | 'select';
      result: arrow.Table | undefined;
      query: string;
      lastQueryStatement: string;
      durationMs?: number;
      completedAt?: number;
    }
  | {
      status: 'success';
      type: 'exec';
      query: string;
      lastQueryStatement: string;
      durationMs?: number;
      completedAt?: number;
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
    initialize?: () => Promise<void>;
    destroy?: () => Promise<void>;
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
     * Ensure an id-addressable query exists without requiring it to be an open
     * workbench tab.
     */
    ensureQuery(queryId: string, options?: EnsureSqlQueryOptions): SqlEditorQuery;

    /**
     * Remove an id-addressable query and its runtime result.
     */
    removeQuery(queryId: string): void;

    /**
     * Rename an id-addressable query.
     */
    renameQuery(queryId: string, name: string): void;

    /**
     * Run a query by id, optionally overriding its stored SQL text first.
     */
    runQueryById(queryId: string, query?: string): Promise<void>;

    /**
     * Abort a running query by id.
     */
    abortQueryById(queryId: string): void;

    /**
     * Clear the runtime result for a query id.
     */
    clearQueryResult(queryId: string): void;

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
    BaseRoomStoreState & DbSliceState & SqlEditorSliceState
  >((set, get, store) => {
    return {
      sqlEditor: {
        initialize: async () => {
          registerCommandsForOwner(
            store,
            SQL_EDITOR_COMMAND_OWNER,
            createSqlEditorCommands(),
          );
        },
        destroy: async () => {
          unregisterCommandsForOwner(store, SQL_EDITOR_COMMAND_OWNER);
        },
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

        ensureQuery: (queryId, options = {}) => {
          const now = Date.now();
          const existingQuery = get().sqlEditor.config.queries.find(
            (query) => query.id === queryId,
          );
          const shouldOpen = Boolean(options.open || options.select);
          const nextQuery: SqlEditorQuery = existingQuery
            ? {
                ...existingQuery,
                ...(options.name !== undefined ? {name: options.name} : {}),
                ...(options.query !== undefined ? {query: options.query} : {}),
                ...(options.select ? {lastOpenedAt: now} : {}),
              }
            : {
                id: queryId,
                name: options.name ?? 'SQL Query',
                query: options.query ?? '',
                ...(options.select ? {lastOpenedAt: now} : {}),
              };

          set((state) =>
            produce(state, (draft) => {
              const config = draft.sqlEditor.config;
              const index = config.queries.findIndex(
                (query) => query.id === queryId,
              );
              if (index >= 0) {
                config.queries[index] = nextQuery;
              } else {
                config.queries.push(nextQuery);
              }
              if (shouldOpen && !config.openTabs.includes(queryId)) {
                config.openTabs.push(queryId);
              }
              if (options.select) {
                config.selectedQueryId = queryId;
              }
            }),
          );

          return nextQuery;
        },

        removeQuery: (queryId) => {
          const currentResult = get().sqlEditor.queryResultsById[queryId];
          if (currentResult?.status === 'loading') {
            currentResult.controller.abort();
          }

          set((state) =>
            produce(state, (draft) => {
              const config = draft.sqlEditor.config;
              const wasSelected = config.selectedQueryId === queryId;
              config.queries = config.queries.filter(
                (query) => query.id !== queryId,
              );
              config.openTabs = config.openTabs.filter((id) => id !== queryId);
              delete draft.sqlEditor.queryResultsById[queryId];

              if (config.queries.length === 0) {
                config.queries.push({
                  id: 'default',
                  name: 'SQL',
                  query: '',
                  lastOpenedAt: Date.now(),
                });
                config.openTabs = ['default'];
                config.selectedQueryId = 'default';
                return;
              }

              if (wasSelected) {
                const nextSelectedId =
                  config.openTabs[0] ?? config.queries[0]?.id;
                if (nextSelectedId) {
                  config.selectedQueryId = nextSelectedId;
                  if (!config.openTabs.includes(nextSelectedId)) {
                    config.openTabs.push(nextSelectedId);
                  }
                }
              }
            }),
          );
        },

        renameQuery: (queryId, name) => {
          set((state) =>
            produce(state, (draft) => {
              const query = draft.sqlEditor.config.queries.find(
                (candidate) => candidate.id === queryId,
              );
              if (query) {
                query.name = name || query.name;
              }
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
          set((state) =>
            produce(state, (draft) => {
              const config = draft.sqlEditor.config;

              if (config.queries.length <= 1) {
                // Don't delete the last query
                return;
              }

              const wasSelected = config.selectedQueryId === queryId;
              const deletingOpenIndex = config.openTabs.indexOf(queryId);

              config.queries = config.queries.filter((q) => q.id !== queryId);
              config.openTabs = config.openTabs.filter(
                (id) => id !== queryId,
              );
              delete draft.sqlEditor.queryResultsById[queryId];

              // If we deleted the selected query, select another one
              if (wasSelected) {
                const newOpenTabs = config.openTabs;
                const remainingQueries = config.queries;

                if (newOpenTabs.length > 0) {
                  // Select from remaining open tabs
                  const baseIndex =
                    deletingOpenIndex <= 0 ? 0 : deletingOpenIndex - 1;
                  const newIndex = Math.min(
                    baseIndex,
                    newOpenTabs.length - 1,
                  );
                  const newSelectedId =
                    newOpenTabs[newIndex] ?? remainingQueries[0]?.id;
                  if (newSelectedId) {
                    config.selectedQueryId = newSelectedId;
                    const newSelectedQuery = config.queries.find(
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
                    config.openTabs.push(queryToOpen.id);
                    config.selectedQueryId = queryToOpen.id;
                    queryToOpen.lastOpenedAt = Date.now();
                  }
                }
              }
            }),
          );
        },

        renameQueryTab: (queryId, newName) => {
          get().sqlEditor.renameQuery(queryId, newName);
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
          get().sqlEditor.runQueryById(get().sqlEditor.config.selectedQueryId),

        abortCurrentQuery: () => {
          get().sqlEditor.abortQueryById(get().sqlEditor.config.selectedQueryId);
        },

        setQueryResultLimit: (limit) => {
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.queryResultLimit = limit;
            }),
          );
        },

        abortQueryById: (queryId) => {
          const currentResult = get().sqlEditor.queryResultsById[queryId];
          if (currentResult?.status === 'loading' && currentResult.controller) {
            currentResult.controller.abort();
          }

          set((state) =>
            produce(state, (draft) => {
              const result = draft.sqlEditor.queryResultsById[queryId];
              if (result?.status === 'loading') {
                result.isBeingAborted = true;
              }
            }),
          );
        },

        clearQueryResult: (queryId) => {
          const currentResult = get().sqlEditor.queryResultsById[queryId];
          if (currentResult?.status === 'loading') {
            currentResult.controller.abort();
          }
          set((state) =>
            produce(state, (draft) => {
              delete draft.sqlEditor.queryResultsById[queryId];
            }),
          );
        },

        parseAndRunQuery: async (query): Promise<void> =>
          get().sqlEditor.runQueryById(
            get().sqlEditor.config.selectedQueryId,
            query,
          ),

        runQueryById: async (queryId, queryOverride): Promise<void> => {
          const storedQuery = get().sqlEditor.config.queries.find(
            (query) => query.id === queryId,
          );
          const query = queryOverride ?? storedQuery?.query ?? '';
          const existingResult =
            get().sqlEditor.queryResultsById[queryId];
          if (existingResult?.status === 'loading') {
            throw new Error('Query already running');
          }
          if (!query.trim()) {
            return;
          }

          get().sqlEditor.ensureQuery(queryId, {query});

          // Create abort controller for this query execution
          const queryController = new AbortController();
          const startedAt = Date.now();

          // First update loading state and clear results
          set((state) =>
            produce(state, (draft) => {
              draft.sqlEditor.selectedTable = undefined;
              draft.sqlEditor.queryResultsById[queryId] = {
                status: 'loading',
                isBeingAborted: false,
                controller: queryController,
                startedAt,
              };
            }),
          );

          let queryResult: QueryResult;
          try {
            const dbConnectors = get().db.connectors;
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
              const result = dbConnectors?.runQuery
                ? (
                    await dbConnectors.runQuery({
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
                durationMs: Date.now() - startedAt,
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

              const result = dbConnectors?.runQuery
                ? (
                    await dbConnectors.runQuery({
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
                  durationMs: Date.now() - startedAt,
                };
              } else if (/^(PRAGMA)/i.test(lastQueryStatement)) {
                queryResult = {
                  status: 'success',
                  type: 'pragma',
                  query,
                  lastQueryStatement,
                  result,
                  durationMs: Date.now() - startedAt,
                };
              } else {
                queryResult = {
                  status: 'success',
                  type: 'exec',
                  query,
                  lastQueryStatement,
                  durationMs: Date.now() - startedAt,
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
              queryResult = {
                status: 'aborted',
                durationMs: Date.now() - startedAt,
              };
            } else {
              queryResult = {
                status: 'error',
                error: errorMessage,
                durationMs: Date.now() - startedAt,
              };
            }
          }
          queryResult = {...queryResult, completedAt: Date.now()};

          // Update state without Immer since Arrow Tables don't play well with drafts.
          set((state) => {
            const currentResult = state.sqlEditor.queryResultsById[queryId];
            const queryStillExists = state.sqlEditor.config.queries.some(
              (candidate) => candidate.id === queryId,
            );
            if (
              !queryStillExists ||
              currentResult?.status !== 'loading' ||
              currentResult.controller !== queryController
            ) {
              return state;
            }

            return {
              ...state,
              sqlEditor: {
                ...state.sqlEditor,
                queryResultsById: {
                  ...state.sqlEditor.queryResultsById,
                  [queryId]: queryResult,
                },
              },
            };
          });
        },
      },
    } satisfies SqlEditorSliceState;
  });
}

type RoomStateWithSqlEditor = RoomShellSliceState & SqlEditorSliceState;

type SqlEditorCommandStoreState = BaseRoomStoreState &
  DbSliceState &
  SqlEditorSliceState;

const SqlEditorRunQueryCommandInput = z.object({
  query: z.string().describe('SQL query text to run.'),
});
type SqlEditorRunQueryCommandInput = z.infer<
  typeof SqlEditorRunQueryCommandInput
>;

const SqlEditorTabIdInput = z.object({
  queryId: z.string().describe('ID of the query tab.'),
});
type SqlEditorTabIdInput = z.infer<typeof SqlEditorTabIdInput>;

const SqlEditorRenameTabInput = z.object({
  queryId: z.string().describe('ID of the query tab to rename.'),
  name: z.string().min(1).describe('New tab name.'),
});
type SqlEditorRenameTabInput = z.infer<typeof SqlEditorRenameTabInput>;

const SqlEditorResultLimitInput = z.object({
  limit: z.number().int().positive().describe('Row limit for query results.'),
});
type SqlEditorResultLimitInput = z.infer<typeof SqlEditorResultLimitInput>;

function createSqlEditorCommands(): RoomCommand<SqlEditorCommandStoreState>[] {
  const ensureQueryTabExists = (
    state: SqlEditorCommandStoreState,
    queryId: string,
  ) => {
    if (!state.sqlEditor.config.queries.some((query) => query.id === queryId)) {
      throw new Error(`Unknown query tab "${queryId}".`);
    }
  };

  return [
    {
      id: 'sql-editor.run-current-query',
      name: 'Run current query',
      description: 'Execute the selected SQL query tab',
      group: 'SQL Editor',
      keywords: ['sql', 'run', 'execute', 'query'],
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      ui: {
        keystrokes: 'Mod+Enter',
      },
      isEnabled: ({getState}) => {
        const state = getState();
        const selectedQueryId = state.sqlEditor.config.selectedQueryId;
        const queryResult = state.sqlEditor.queryResultsById[selectedQueryId];
        return (
          queryResult?.status !== 'loading' &&
          state.sqlEditor.getCurrentQuery().trim().length > 0
        );
      },
      execute: async ({getState}) => {
        await getState().sqlEditor.parseAndRunCurrentQuery();
        return {
          success: true,
          commandId: 'sql-editor.run-current-query',
          message: 'Executed current query.',
        };
      },
    },
    {
      id: 'sql-editor.run-query',
      name: 'Run query text',
      description: 'Execute an explicitly provided SQL query',
      group: 'SQL Editor',
      keywords: ['sql', 'run', 'execute', 'query', 'text'],
      inputSchema: SqlEditorRunQueryCommandInput,
      inputDescription: 'Provide query SQL to execute.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: async ({getState}, input) => {
        const {query} = input as SqlEditorRunQueryCommandInput;
        await getState().sqlEditor.parseAndRunQuery(query);
        return {
          success: true,
          commandId: 'sql-editor.run-query',
          message: 'Executed SQL query.',
        };
      },
    },
    {
      id: 'sql-editor.abort-current-query',
      name: 'Abort current query',
      description: 'Cancel the currently running SQL query',
      group: 'SQL Editor',
      keywords: ['sql', 'abort', 'cancel', 'query'],
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      isEnabled: ({getState}) => {
        const state = getState();
        const selectedQueryId = state.sqlEditor.config.selectedQueryId;
        return (
          state.sqlEditor.queryResultsById[selectedQueryId]?.status ===
          'loading'
        );
      },
      execute: ({getState}) => {
        getState().sqlEditor.abortCurrentQuery();
        return {
          success: true,
          commandId: 'sql-editor.abort-current-query',
          message: 'Abort signal sent to current query.',
        };
      },
    },
    {
      id: 'sql-editor.create-query-tab',
      name: 'Create query tab',
      description: 'Open a new SQL query tab',
      group: 'SQL Editor',
      keywords: ['sql', 'tab', 'new', 'query'],
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'low',
      },
      execute: ({getState}) => {
        const newTab = getState().sqlEditor.createQueryTab();
        return {
          success: true,
          commandId: 'sql-editor.create-query-tab',
          message: `Created query tab "${newTab.name}".`,
          data: {
            queryId: newTab.id,
          },
        };
      },
    },
    {
      id: 'sql-editor.select-query-tab',
      name: 'Select query tab',
      description: 'Switch active SQL query tab by ID',
      group: 'SQL Editor',
      keywords: ['sql', 'tab', 'select', 'switch'],
      inputSchema: SqlEditorTabIdInput,
      inputDescription: 'Provide queryId to activate.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        ensureQueryTabExists(
          getState(),
          (input as SqlEditorTabIdInput).queryId,
        );
      },
      execute: ({getState}, input) => {
        const {queryId} = input as SqlEditorTabIdInput;
        getState().sqlEditor.setSelectedQueryId(queryId);
        return {
          success: true,
          commandId: 'sql-editor.select-query-tab',
          message: `Selected query tab "${queryId}".`,
        };
      },
    },
    {
      id: 'sql-editor.rename-query-tab',
      name: 'Rename query tab',
      description: 'Rename a SQL query tab by ID',
      group: 'SQL Editor',
      keywords: ['sql', 'tab', 'rename'],
      inputSchema: SqlEditorRenameTabInput,
      inputDescription: 'Provide queryId and name.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        ensureQueryTabExists(
          getState(),
          (input as SqlEditorRenameTabInput).queryId,
        );
      },
      execute: ({getState}, input) => {
        const {queryId, name} = input as SqlEditorRenameTabInput;
        getState().sqlEditor.renameQueryTab(queryId, name);
        return {
          success: true,
          commandId: 'sql-editor.rename-query-tab',
          message: `Renamed query tab "${queryId}".`,
        };
      },
    },
    {
      id: 'sql-editor.delete-query-tab',
      name: 'Delete query tab',
      description: 'Delete a SQL query tab by ID',
      group: 'SQL Editor',
      keywords: ['sql', 'tab', 'delete', 'remove'],
      inputSchema: SqlEditorTabIdInput,
      inputDescription: 'Provide queryId to delete.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'medium',
        requiresConfirmation: true,
      },
      validateInput: (input, {getState}) => {
        const state = getState();
        ensureQueryTabExists(state, (input as SqlEditorTabIdInput).queryId);
        if (state.sqlEditor.config.queries.length <= 1) {
          throw new Error('Cannot delete the last remaining query tab.');
        }
      },
      execute: ({getState}, input) => {
        const {queryId} = input as SqlEditorTabIdInput;
        getState().sqlEditor.deleteQueryTab(queryId);
        return {
          success: true,
          commandId: 'sql-editor.delete-query-tab',
          message: `Deleted query tab "${queryId}".`,
        };
      },
    },
    {
      id: 'sql-editor.clear-query-results',
      name: 'Clear query results',
      description: 'Clear all cached SQL query results',
      group: 'SQL Editor',
      keywords: ['sql', 'clear', 'results'],
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      isEnabled: ({getState}) =>
        Object.keys(getState().sqlEditor.queryResultsById).length > 0,
      execute: ({getState}) => {
        getState().sqlEditor.clearQueryResults();
        return {
          success: true,
          commandId: 'sql-editor.clear-query-results',
          message: 'Cleared query results.',
        };
      },
    },
    {
      id: 'sql-editor.set-result-limit',
      name: 'Set query result limit',
      description: 'Set max rows returned for query result previews',
      group: 'SQL Editor',
      keywords: ['sql', 'limit', 'rows', 'result'],
      inputSchema: SqlEditorResultLimitInput,
      inputDescription: 'Provide positive integer limit.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {limit} = input as SqlEditorResultLimitInput;
        getState().sqlEditor.setQueryResultLimit(limit);
        return {
          success: true,
          commandId: 'sql-editor.set-result-limit',
          message: `Set query result limit to ${limit}.`,
        };
      },
    },
  ];
}

export function useStoreWithSqlEditor<T>(
  selector: (state: RoomStateWithSqlEditor) => T,
): T {
  return useBaseRoomShellStore<RoomShellSliceState, T>((state) =>
    selector(state as unknown as RoomStateWithSqlEditor),
  );
}
