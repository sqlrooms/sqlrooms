import {
  createTableFromQuery,
  DuckQueryError,
  getDuckDb,
  getDuckTables,
  getDuckTableSchemas,
  useDuckDb,
} from '@sqlrooms/duckdb';
import {
  createSlice,
  DataSourceStatus,
  ProjectState,
  StateCreator,
  useBaseProjectStore,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig, DataSourceTypes} from '@sqlrooms/project-config';
import {generateUniqueName, genRandomStr} from '@sqlrooms/utils';
import {Table} from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import {produce} from 'immer';
import {z} from 'zod';

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

export type SqlEditorSliceState = {
  sqlEditor: {
    /**
     * Add or update a SQL query data source.
     * @param tableName - The name of the table to create or update.
     * @param query - The SQL query to execute.
     * @param oldTableName - The name of the table to replace (optional).
     */
    addOrUpdateSqlQuery(
      tableName: string,
      query: string,
      oldTableName?: string,
    ): Promise<void>;

    /**
     * Execute a SQL query and return the results.
     * @param query - The SQL query to execute.
     * @param schema - The schema to use (default: main).
     */
    executeQuery(
      query: string,
      schema?: string,
    ): Promise<{
      results?: Table;
      error?: string;
    }>;

    /**
     * Export query results to CSV.
     * @param results - The query results to export.
     * @param filename - Optional filename (default is generated).
     */
    exportResultsToCsv(results: Table, filename?: string): void;

    /**
     * Refresh table schemas after a query execution.
     */
    refreshTableSchemas(): Promise<void>;

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
     * @param defaultQuery - Optional default query text to return if no query is found.
     */
    getCurrentQuery(defaultQuery?: string): string;
  };
};

export function createSqlEditorSlice<
  PC extends BaseProjectConfig & SqlEditorSliceConfig,
>(): StateCreator<SqlEditorSliceState> {
  return createSlice<PC, SqlEditorSliceState>((set, get) => ({
    sqlEditor: {
      addOrUpdateSqlQuery: async (tableName, query, oldTableName) => {
        const {schema} = get().project;
        const newTableName =
          tableName !== oldTableName
            ? generateUniqueName(tableName, await getDuckTables(schema))
            : tableName;
        const {rowCount} = await createTableFromQuery(newTableName, query);
        get().project.setTableRowCount(newTableName, rowCount);
        set((state) =>
          produce(state, (draft) => {
            const newDataSource = {
              type: DataSourceTypes.enum.sql,
              sqlQuery: query,
              tableName: newTableName,
            };
            if (oldTableName) {
              draft.project.config.dataSources =
                draft.project.config.dataSources.map((dataSource) =>
                  dataSource.tableName === oldTableName
                    ? newDataSource
                    : dataSource,
                );
              delete draft.project.dataSourceStates[oldTableName];
            } else {
              draft.project.config.dataSources.push(newDataSource);
            }
            draft.project.dataSourceStates[newTableName] = {
              status: DataSourceStatus.READY,
            };
          }),
        );
        await get().project.setTables(await getDuckTableSchemas());
      },

      executeQuery: async (query, schema = 'main') => {
        const duckDb = await getDuckDb();
        if (!duckDb.conn) {
          return {error: 'No DuckDB connection available'};
        }

        try {
          await duckDb.conn.query(`SET search_path = ${schema}`);
          const results = await duckDb.conn.query(query);
          await duckDb.conn.query(`SET search_path = main`);

          // Refresh table schemas after query execution
          await get().sqlEditor.refreshTableSchemas();

          return {results};
        } catch (e) {
          console.error(e);
          const errorMessage =
            e instanceof DuckQueryError
              ? e.getMessageForUser()
              : 'Query failed';

          return {error: errorMessage || String(e)};
        }
      },

      exportResultsToCsv: (results, filename) => {
        if (!results) return;
        const blob = new Blob([csvFormat(results.toArray())], {
          type: 'text/plain;charset=utf-8',
        });
        saveAs(blob, filename || `export-${genRandomStr(5)}.csv`);
      },

      refreshTableSchemas: async () => {
        console.log('refreshTableSchemas');
        const tables = await getDuckTableSchemas();
        await get().project.setTables(tables);
      },

      createQueryTab: (initialQuery = '') => {
        const sqlEditorConfig = get().project.config.sqlEditor;
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
            draft.project.config.sqlEditor.queries.push(newQuery);
            draft.project.config.sqlEditor.selectedQueryId = newQuery.id;
          }),
        );

        return newQuery;
      },

      deleteQueryTab: (queryId) => {
        const sqlEditorConfig = get().project.config.sqlEditor;
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
            draft.project.config.sqlEditor.queries = filteredQueries;

            // If we're deleting the selected tab, select the previous one or the first one
            if (isSelected && filteredQueries.length > 0) {
              const newSelectedIndex = Math.max(0, index - 1);
              // Safely access the ID with fallback to the first query if needed
              const newSelectedId =
                filteredQueries[newSelectedIndex]?.id ?? filteredQueries[0]?.id;
              if (newSelectedId) {
                draft.project.config.sqlEditor.selectedQueryId = newSelectedId;
              }
            }
          }),
        );
      },

      renameQueryTab: (queryId, newName) => {
        set((state) =>
          produce(state, (draft) => {
            const query = draft.project.config.sqlEditor.queries.find(
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
            const query = draft.project.config.sqlEditor.queries.find(
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
            draft.project.config.sqlEditor.selectedQueryId = queryId;
          }),
        );
      },

      getCurrentQuery: (defaultQuery = '') => {
        const sqlEditorConfig = get().project.config.sqlEditor;
        const selectedId = sqlEditorConfig.selectedQueryId;
        // Find query by ID
        const query = sqlEditorConfig.queries.find((q) => q.id === selectedId);
        // If found, return its query text, otherwise default
        return query?.query || defaultQuery;
      },
    },
  }));
}

type ProjectConfigWithSqlEditor = BaseProjectConfig & SqlEditorSliceConfig;
type ProjectStateWithSqlEditor = ProjectState<ProjectConfigWithSqlEditor> &
  SqlEditorSliceState;

export function useStoreWithSqlEditor<T>(
  selector: (state: ProjectStateWithSqlEditor) => T,
): T {
  return useBaseProjectStore<
    BaseProjectConfig & SqlEditorSliceConfig,
    ProjectState<ProjectConfigWithSqlEditor>,
    T
  >((state) => selector(state as unknown as ProjectStateWithSqlEditor));
}
