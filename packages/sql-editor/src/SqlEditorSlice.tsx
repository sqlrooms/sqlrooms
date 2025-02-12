import {
  createTableFromQuery,
  getDuckTables,
  getDuckTableSchemas,
} from '@sqlrooms/duckdb';
import {
  createProjectSlice,
  DataSourceStatus,
  ProjectState,
  useBaseProjectStore,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig, DataSourceTypes} from '@sqlrooms/project-config';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {SqlEditorSliceConfig} from './SqlEditorSliceConfig';

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
    setSqlEditorConfig: (config: SqlEditorSliceConfig['sqlEditor']) => void;
    /**
     * Pin a panel.
     * @param panel - The panel to pin.
     */
    addOrUpdateSqlQuery(
      tableName: string,
      query: string,
      oldTableName?: string,
    ): Promise<void>;
  };
};

export function createSqlEditorSlice<
  PC extends BaseProjectConfig & SqlEditorSliceConfig,
>() {
  return createProjectSlice<PC, SqlEditorSliceState>((set, get) => ({
    sqlEditor: {
      setSqlEditorConfig: (config: SqlEditorSliceConfig['sqlEditor']) => {
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectConfig.sqlEditor = config;
          }),
        );
      },

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
              draft.project.projectConfig.dataSources =
                draft.project.projectConfig.dataSources.map((dataSource) =>
                  dataSource.tableName === oldTableName
                    ? newDataSource
                    : dataSource,
                );
              delete draft.project.dataSourceStates[oldTableName];
            } else {
              draft.project.projectConfig.dataSources.push(newDataSource);
            }
            draft.project.dataSourceStates[newTableName] = {
              status: DataSourceStatus.READY,
            };
          }),
        );
        await get().project.setTables(await getDuckTableSchemas());
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
