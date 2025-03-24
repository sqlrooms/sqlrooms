import {
  DataTable,
  DuckDbSliceState,
  DuckQueryError,
  createDuckDbSlice,
  createTableFromArrowTable,
  createTableFromObjects,
  createTableFromQuery,
  createViewFromFile,
} from '@sqlrooms/duckdb';
import {
  BaseProjectConfig,
  DataSource,
  DataSourceTypes,
  FileDataSource,
  SqlQueryDataSource,
  UrlDataSource,
} from '@sqlrooms/project';
import {ErrorBoundary} from '@sqlrooms/ui';
import {
  ProgressInfo,
  convertToUniqueColumnOrTableName,
  downloadFile,
  splitFilePath,
} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {castDraft, produce} from 'immer';
import {ReactNode} from 'react';
import {StateCreator, StoreApi, createStore} from 'zustand';
import {
  DataSourceState,
  DataSourceStatus,
  ProjectFileInfo,
  ProjectFileState,
} from '../../project-builder/src/types';
import {processDroppedFile} from '../../project-builder/src/utils/processDroppedFiles';
import {useBaseProjectStore} from './ProjectStateProvider';

export type TaskProgress = {
  progress?: number | undefined;
  message: string;
};

const INIT_DB_TASK = 'init-db';
const INIT_PROJECT_TASK = 'init-project';
const DOWNLOAD_DATA_SOURCES_TASK = 'download-data-sources';

export type ProjectStore<PC extends BaseProjectConfig> = StoreApi<
  ProjectState<PC>
>;

export type ProjectPanelInfo = {
  title: string;
  icon: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'main' | 'top-bar';
};

export const INITIAL_BASE_PROJECT_STATE: Omit<
  ProjectStateProps<BaseProjectConfig>,
  'config' | 'lastSavedConfig' | 'panels'
> = {
  schema: 'main',
  tasksProgress: {},
  projectId: undefined,
  initialized: false,
  isDataAvailable: false,
  isReadOnly: false,
  projectFiles: [],
  projectFilesProgress: {},
  // userId: undefined,
  tables: [],
  tableRowCounts: {},
  dataSourceStates: {},
  captureException(exception: unknown) {
    console.error(exception);
  },
  CustomErrorBoundary: ErrorBoundary,
};

export const INITIAL_BASE_PROJECT_CONFIG: BaseProjectConfig = {
  title: '',
  description: '',
  dataSources: [],
};

export type ProjectStateProps<PC extends BaseProjectConfig> = {
  schema: string;
  projectId: string | undefined; // undefined if the project is new
  panels: Record<string, ProjectPanelInfo>;
  isReadOnly: boolean;
  lastSavedConfig: PC | undefined;
  tasksProgress: Record<string, TaskProgress>;
  tables: DataTable[];
  projectFiles: ProjectFileInfo[];
  projectFilesProgress: {[pathname: string]: ProjectFileState};
  initialized: boolean; // Whether the project has been initialized so we can render UI
  isDataAvailable: boolean; // Whether the data has been loaded (on initialization)
  dataSourceStates: {[tableName: string]: DataSourceState}; // TODO
  tableRowCounts: {[tableName: string]: number};
  captureException: (exception: unknown, captureContext?: unknown) => void;
  CustomErrorBoundary: React.ComponentType<{
    onRetry?: () => void;
    children?: ReactNode;
  }>;
};

export type ProjectStateActions<PC extends BaseProjectConfig> = {
  /**
   * Initialize the project state.
   * @returns A promise that resolves when the project state has been initialized.
   */
  initialize: () => Promise<void>;
  setTaskProgress: (id: string, taskProgress: TaskProgress | undefined) => void;
  getLoadingProgress: () => TaskProgress | undefined;
  /**
   * Set the project config.
   * @param config - The project config to set.
   */
  setProjectConfig: (config: PC) => void;
  setProjectId: (projectId: string | undefined) => void;
  /**
   * Set the last saved project config. This can be used to check if the project has unsaved changes.
   * @param config - The project config to set.
   */
  setLastSavedConfig: (config: PC) => void;
  /**
   * Check if the project has unsaved changes.
   * @returns True if the project has unsaved changes, false otherwise.
   */
  hasUnsavedChanges(): boolean; // since last save
  replaceProjectFile(
    projectFile: ProjectFileInfo,
  ): Promise<DataTable | undefined>;
  addProjectFile(
    info: File | ProjectFileInfo,
    desiredTableName?: string,
  ): Promise<DataTable | undefined>;
  removeProjectFile(pathname: string): void;
  setProjectFiles(info: ProjectFileInfo[]): void;
  setProjectFileProgress(pathname: string, fileState: ProjectFileState): void;
  /**
   * Add a table to the project.
   * @param tableName - The name of the table to add.
   * @param data - The data to add to the table: an arrow table or an array of records.
   * @returns A promise that resolves to the table that was added.
   */
  addTable(
    tableName: string,
    data: arrow.Table | Record<string, unknown>[],
  ): Promise<DataTable>;
  addDataSource: (
    dataSource: DataSource,
    status?: DataSourceStatus,
  ) => Promise<void>;
  getTable(tableName: string): DataTable | undefined;
  setTables(dataTable: DataTable[]): Promise<void>;
  setTableRowCount(tableName: string, rowCount: number): void;
  setProjectTitle(title: string): void;
  setDescription(description: string): void;
  areDatasetsReady(): boolean;
  findTableByName(tableName: string): DataTable | undefined;
  /**
   * Update the status of all data sources based on the current tables.
   */
  updateReadyDataSources(): Promise<void>;
  onDataUpdated: () => Promise<void>;
  areViewsReadyToRender(): boolean;
  /**
   * Refresh table schemas from the database.
   * @returns A promise that resolves to the updated tables.
   */
  refreshTableSchemas(): Promise<DataTable[]>;
};

export type ProjectState<PC extends BaseProjectConfig> = {
  config: PC;
  project: ProjectStateProps<PC> & ProjectStateActions<PC>;
} & DuckDbSliceState;

export function createSlice<PC extends BaseProjectConfig, S>(
  sliceCreator: (...args: Parameters<StateCreator<S & ProjectState<PC>>>) => S,
): StateCreator<S> {
  return (set, get, store) =>
    sliceCreator(
      set,
      get as () => S & ProjectState<PC>,
      store as StoreApi<S & ProjectState<PC>>,
    );
}

/**
 * 	This type takes a union type U (for example, A | B) and transforms it into an intersection type (A & B). This is useful because if you pass in, say, two slices of type { a: number } and { b: string }, the union of the slice types would be { a: number } | { b: string }, but you really want an object that has both properties—i.e. { a: number } & { b: string }.
 */
type InitialState<PC extends BaseProjectConfig> = {
  config: Omit<PC, keyof BaseProjectConfig> & Partial<BaseProjectConfig>;
  project: Partial<Omit<ProjectStateProps<PC>, 'config' | 'panels'>> & {
    panels: ProjectStateProps<PC>['panels'];
  };
};

/**
 * Create a project store with custom fields and methods
 * @param initialState - The initial state and config for the project
 * @param sliceCreators - The slices to add to the project store
 * @returns The project store and a hook for accessing the project store
 */
export function createProjectStore<
  PC extends BaseProjectConfig,
  AppState extends ProjectState<PC>,
>(
  stateCreator: StateCreator<AppState>,
  // initialState: InitialState<PC>,
  // ...sliceCreators: ReturnType<typeof createSlice<PC, any>>[]
) {
  // @ts-ignore TODO fix typing
  // const projectStore = createStore<AppState>((set, get, store) => {
  //   return {
  //     ...createProjectSlice<PC>(initialState)(set, get, store),
  //     ...sliceCreators.reduce(
  //       (acc, slice) => ({...acc, ...slice(set, get, store)}),
  //       {},
  //     ),
  //   };
  // });
  const projectStore = createStore<AppState>(stateCreator);
  projectStore.getState().project.initialize();

  function useProjectStore<T>(selector: (state: AppState) => T): T {
    // @ts-ignore TODO fix typing
    return useBaseProjectStore(selector as (state: AppState) => T);
  }

  return {projectStore, useProjectStore};
}

export function createProjectSlice<PC extends BaseProjectConfig>(
  props: InitialState<PC>,
): StateCreator<ProjectState<PC>> {
  const {config: configProps, project: projectStateProps, ...restState} = props;
  const initialConfig: PC = {
    ...INITIAL_BASE_PROJECT_CONFIG,
    ...configProps,
    ...createDefaultDuckDbConfig(),
  } as PC;
  const initialProjectState: ProjectStateProps<PC> = {
    ...INITIAL_BASE_PROJECT_STATE,
    ...projectStateProps,
    schema: projectStateProps.schema ?? INITIAL_BASE_PROJECT_STATE.schema,
    lastSavedConfig: undefined,
  };

  const slice: StateCreator<ProjectState<PC>> = (set, get) => {
    const projectState: ProjectState<PC>['project'] = {
      ...initialProjectState,

      async initialize() {
        const {setTaskProgress} = get().project;
        setTaskProgress(INIT_DB_TASK, {
          message: 'Initializing database…',
          progress: undefined,
        });

        await get().duckdb.initialize();

        setTaskProgress(INIT_DB_TASK, undefined);

        setTaskProgress(INIT_PROJECT_TASK, {
          message: 'Loading data sources…',
          progress: undefined,
        });
        await get().project.updateReadyDataSources();
        await get().project.maybeDownloadDataSources();
        setTaskProgress(INIT_PROJECT_TASK, undefined);

        await get().project.onDataUpdated();
        set((state) =>
          produce(state, (draft) => {
            draft.project.initialized = true;
          }),
        );
      },

      onDataUpdated: async () => {
        // Do nothing: to be overridden by the view store
      },

      areViewsReadyToRender: () => {
        // Can be overridden by the view store
        return true;
      },

      setTaskProgress(id, taskProgress) {
        set((state) =>
          produce(state, (draft) => {
            if (taskProgress) {
              draft.project.tasksProgress[id] = taskProgress;
            } else {
              delete draft.project.tasksProgress[id];
            }
          }),
        );
      },

      /** Returns the progress of the last task */
      getLoadingProgress() {
        const {tasksProgress} = get().project;
        const keys = Object.keys(tasksProgress);
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
          return tasksProgress[lastKey];
        }
        return undefined;
      },

      // setUserId: (userId) => set(() => ({userId})),
      setProjectId: (projectId) =>
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectId = projectId;
          }),
        ),
      setProjectConfig: (config) =>
        set((state) =>
          produce(state, (draft) => {
            draft.config = castDraft(config);
          }),
        ),
      setLastSavedConfig: (config) =>
        set((state) =>
          produce(state, (draft) => {
            draft.project.lastSavedConfig = castDraft(config);
          }),
        ),
      hasUnsavedChanges: () => {
        const {lastSavedConfig} = get().project;
        const {config} = get();
        return config !== lastSavedConfig;
      },

      addDataSource: async (dataSource, status = DataSourceStatus.PENDING) => {
        set((state) =>
          produce(state, (draft) => {
            const dataSources = draft.config.dataSources;
            const tableName = dataSource.tableName;
            const index = dataSources.findIndex(
              (d) => d.tableName === tableName,
            );
            if (index >= 0) {
              dataSources[index] = dataSource;
            } else {
              dataSources.push(dataSource);
            }
            draft.project.dataSourceStates[tableName] = {status};
          }),
        );
        await get().project.maybeDownloadDataSources();
      },

      async addTable(tableName, data) {
        const {tables} = get().project;
        const {connector} = get().duckdb;
        const table = tables.find((t) => t.tableName === tableName);
        if (table) {
          return table;
        }

        if (data instanceof arrow.Table) {
          await createTableFromArrowTable(tableName, data, connector);
        } else {
          await createTableFromObjects(tableName, data, connector);
        }

        const newTable = await connector.getTableSchema(tableName);

        set((state) =>
          produce(state, (draft) => {
            draft.project.tables.push(newTable);
          }),
        );
        await get().project.updateReadyDataSources();
        return newTable;
      },

      async addOrUpdateSqlQueryDataSource(tableName, query, oldTableName) {
        const {schema} = get().project;
        const {connector} = get().duckdb;
        const newTableName =
          tableName !== oldTableName
            ? convertToUniqueColumnOrTableName(
                tableName,
                await connector.getTables(schema),
              )
            : tableName;

        const {rowCount} = await createTableFromQuery(
          newTableName,
          query,
          connector,
        );
        get().project.setTableRowCount(newTableName, rowCount);
        set((state) =>
          produce(state, (draft) => {
            const newDataSource = {
              type: DataSourceTypes.enum.sql,
              sqlQuery: query,
              tableName: newTableName,
            };
            if (oldTableName) {
              draft.config.dataSources = draft.config.dataSources.map(
                (dataSource) =>
                  dataSource.tableName === oldTableName
                    ? newDataSource
                    : dataSource,
              );
              delete draft.project.dataSourceStates[oldTableName];
            } else {
              draft.config.dataSources.push(newDataSource);
            }
            draft.project.dataSourceStates[newTableName] = {
              status: DataSourceStatus.READY,
            };
          }),
        );
        await get().project.setTables(await connector.getTableSchemas());
      },

      removeSqlQueryDataSource: async (tableName) => {
        const {connector} = get().duckdb;
        await connector.dropTable(tableName);
        set((state) =>
          produce(state, (draft) => {
            draft.config.dataSources = draft.config.dataSources.filter(
              (d) => d.tableName !== tableName,
            );
            delete draft.project.dataSourceStates[tableName];
          }),
        );
        await get().project.setTables(await connector.getTableSchemas());
      },

      setProjectFiles: (projectFiles) =>
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectFiles = projectFiles;
          }),
        ),

      async replaceProjectFile(projectFile) {
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectFiles = draft.project.projectFiles.map((f) =>
              f.pathname === projectFile.pathname ? projectFile : f,
            );
          }),
        );
        const {connector} = get().duckdb;
        const dataSource = get().config.dataSources.find(
          (d) =>
            d.type === DataSourceTypes.enum.file &&
            d.fileName === projectFile.pathname,
        );
        if (dataSource) {
          set((state) =>
            produce(state, (draft) => {
              draft.project.dataSourceStates[dataSource.tableName] = {
                status: DataSourceStatus.READY,
              };
            }),
          );
          if (projectFile.duckdbFileName) {
            const result = await connector.loadFile(
              projectFile.duckdbFileName,
              dataSource.tableName,
            );
            get().project.setTableRowCount(
              dataSource.tableName,
              result.rowCount,
            );
          }
        }
        await updateTables();
        return dataSource
          ? get().project.findTableByName(dataSource.tableName)
          : undefined;
      },

      async addProjectFile(info, desiredTableName) {
        const {connector} = get().duckdb;
        const fileInfo =
          info instanceof File
            ? (
                await processDroppedFile({
                  file: info,
                  existingTables: await connector.getTables(),
                  duckDbConnector: connector,
                })
              ).fileInfo
            : info;

        const {duckdbFileName, pathname} = fileInfo;
        if (get().project.projectFiles.some((f) => f.pathname === pathname)) {
          return await get().project.replaceProjectFile(fileInfo);
        }
        const {name} = splitFilePath(pathname);
        const tableName =
          desiredTableName ??
          convertToUniqueColumnOrTableName(name, await connector.getTables());
        if (duckdbFileName) {
          const result = await connector.loadFile(duckdbFileName, tableName);
          get().project.setTableRowCount(tableName, result.rowCount);
        }
        // This must come before addDataSource, as addDataSource can trigger
        // download which also adds the file
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectFiles.push(fileInfo);
          }),
        );
        // TODO: pass rowCount to setTables?
        await get().project.addDataSource(
          {
            type: DataSourceTypes.enum.file,
            fileName: pathname,
            tableName,
          },
          duckdbFileName ? DataSourceStatus.READY : DataSourceStatus.PENDING,
        );
        await updateTables();
        set((state) =>
          produce(state, (draft) => {
            draft.project.isDataAvailable = true;
          }),
        );
        return get().project.findTableByName(tableName);
      },
      removeProjectFile(pathname) {
        const {connector} = get().duckdb;
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectFiles = draft.project.projectFiles.filter(
              (f) => f.pathname !== pathname,
            );
            draft.config.dataSources = draft.config.dataSources.filter(
              (d) =>
                d.type !== DataSourceTypes.Enum.file || d.fileName !== pathname,
            );
          }),
        );
        connector.dropFile(pathname);
      },

      setProjectFileProgress(pathname, fileState) {
        set((state) =>
          produce(state, (draft) => {
            draft.project.projectFilesProgress[pathname] = fileState;
            // Update the file size in the project config from the progress info
            const fileInfo = draft.project.projectFiles.find(
              (f) => f.pathname === pathname,
            );
            if (fileInfo && fileInfo.size === undefined) {
              if (fileState.status !== 'error' && fileState.progress) {
                fileInfo.size = fileState.progress.total;
              }
            }
          }),
        );
      },

      async maybeDownloadDataSources() {
        const {projectFilesProgress, dataSourceStates} = get().project;
        const {dataSources} = get().config;
        const pendingDataSources = dataSources.filter(
          (ds) =>
            !dataSourceStates[ds.tableName] ||
            dataSourceStates[ds.tableName]?.status === DataSourceStatus.PENDING,
        );

        const filesToDownload = pendingDataSources.filter((ds) => {
          switch (ds.type) {
            case DataSourceTypes.Enum.file:
              return !projectFilesProgress[ds.fileName];
            case DataSourceTypes.Enum.url:
              return !projectFilesProgress[ds.url];
            default:
              return false;
          }
        }) as (FileDataSource | UrlDataSource)[];

        if (filesToDownload.length > 0) {
          await downloadProjectFiles(filesToDownload);
        }

        const queriesToRun = pendingDataSources.filter(
          (ds) => ds.type === DataSourceTypes.Enum.sql,
        );

        if (queriesToRun.length > 0) {
          await runDataSourceQueries(queriesToRun);
        }

        if (get().config.dataSources.length > 0) {
          set((state) =>
            produce(state, (draft) => {
              draft.project.isDataAvailable = true;
            }),
          );
        }
      },

      setTableRowCount: (tableName, rowCount) =>
        set((state) =>
          produce(state, (draft) => {
            draft.project.tableRowCounts[tableName] = rowCount;
          }),
        ),

      getTable(tableName) {
        return get().project.tables.find((t) => t.tableName === tableName);
      },

      setTables: async (tables) => {
        set((state) =>
          produce(state, (draft) => {
            draft.project.tables = tables;
          }),
        );
        await get().project.updateReadyDataSources();
      },

      setProjectTitle: (title) =>
        set((state) =>
          produce(state, (draft) => {
            draft.config.title = title;
          }),
        ),

      setDescription: (description) =>
        set((state) =>
          produce(state, (draft) => {
            draft.config.description = description;
          }),
        ),

      areDatasetsReady: () => {
        const {dataSourceStates} = get().project;
        const {config} = get();
        const dataSources = config.dataSources;
        return dataSources.every(
          (ds) =>
            dataSourceStates[ds.tableName]?.status === DataSourceStatus.READY,
        );
      },

      findTableByName(tableName: string) {
        return get().project.tables.find((t) => t.tableName === tableName);
      },

      async updateReadyDataSources() {
        const {tables, dataSourceStates} = get().project;
        const {config} = get();
        const dataSources = config.dataSources;
        set((state) =>
          produce(state, (draft) => {
            draft.project.dataSourceStates = dataSources.reduce(
              (acc, ds) => {
                const tableName = ds.tableName;
                const table = tables.find((t) => t.tableName === tableName);
                acc[tableName] = {
                  status: table
                    ? DataSourceStatus.READY
                    : // Don't change the existing status which could be ERROR or PENDING
                      (dataSourceStates[tableName]?.status ??
                      DataSourceStatus.PENDING),
                };
                return acc;
              },
              {...dataSourceStates},
            );
          }),
        );
      },

      async refreshTableSchemas(): Promise<DataTable[]> {
        const {connector} = get().duckdb;
        const tables = await connector.getTableSchemas();
        await get().project.setTables(tables);
        return tables;
      },
    };

    return {
      config: initialConfig,
      project: projectState,
      ...createDuckDbSlice()(set, get),
      ...restState,
    };

    function updateTotalFileDownloadProgress() {
      const {projectFilesProgress, setTaskProgress} = get().project;
      let total = 0,
        loaded = 0;
      for (const p of Object.values(projectFilesProgress)) {
        if (p.status === 'download' || p.status === 'done') {
          total += p.progress?.total || 0;
          loaded += p.progress?.loaded || 0;
        }
      }
      setTaskProgress(DOWNLOAD_DATA_SOURCES_TASK, {
        progress: total > 0 ? Math.round((loaded / total) * 100) : undefined,
        message: 'Downloading data…',
      });
    }

    async function downloadProjectFiles(
      filesToDownload: (FileDataSource | UrlDataSource)[],
    ) {
      if (!filesToDownload.length) return;
      const {
        setProjectFileProgress,
        setTableRowCount,
        setTables,
        captureException,
        setTaskProgress,
      } = get().project;
      filesToDownload.forEach((ds) => {
        const fileName =
          ds.type === DataSourceTypes.Enum.file ? ds.fileName : ds.url;
        set((state) =>
          produce(state, (draft) => {
            const info = {
              duckdbFileName: fileName,
              pathname: fileName,
              file: undefined,
              size: undefined,
            };
            const index = draft.project.projectFiles.findIndex(
              (f) => f.pathname === fileName,
            );
            if (index >= 0) {
              draft.project.projectFiles[index] = info;
            } else {
              draft.project.projectFiles.push(info);
            }
          }),
        );
        setProjectFileProgress(fileName, {status: 'download'});
      });
      if (filesToDownload.length > 0) {
        updateTotalFileDownloadProgress();
      }

      const loadedFiles = await Promise.all(
        filesToDownload.map(async (ds) => {
          const fileName =
            ds.type === DataSourceTypes.Enum.file ? ds.fileName : ds.url;
          try {
            if (ds.type === DataSourceTypes.Enum.file) {
              throw new Error('File data source is not supported');
            }
            const url = ds.url;
            setProjectFileProgress(fileName, {status: 'download'});
            const downloadedFile = await downloadFile(url, {
              onProgress: (progress: ProgressInfo) => {
                setProjectFileProgress(fileName, {
                  status: 'download',
                  progress,
                });
                updateTotalFileDownloadProgress();
              },
            });
            setProjectFileProgress(fileName, {status: 'done'});
            updateTotalFileDownloadProgress();
            const {tableName, rowCount} = await createViewFromFile(
              fileName,
              'main',
              ds.tableName,
              downloadedFile,
            );
            setTableRowCount(tableName, rowCount);
          } catch (err) {
            captureException(err);
            console.error(err);
            setProjectFileProgress(fileName, {
              status: 'error',
              message: 'Download failed',
            });
            // TODO: Make sure the errors are shown
          } finally {
            setTaskProgress(DOWNLOAD_DATA_SOURCES_TASK, undefined);
          }
        }),
      );
      if (loadedFiles.length) {
        await setTables(await get().project.refreshTableSchemas());
      }
    }

    async function runDataSourceQueries(queries: SqlQueryDataSource[]) {
      const {connector} = get().duckdb;
      for (const ds of queries) {
        try {
          const {tableName, sqlQuery} = ds;
          set((state) =>
            produce(state, (draft) => {
              draft.project.dataSourceStates[tableName] = {
                status: DataSourceStatus.FETCHING,
              };
            }),
          );

          const resultTable = await connector.query(
            `CREATE OR REPLACE TABLE ${tableName} AS ${sqlQuery}`,
          );

          const countResult = await connector.query(
            `SELECT COUNT(*) FROM ${tableName}`,
          );
          const rowCount = Number(countResult.getChildAt(0)?.get(0));

          get().project.setTableRowCount(tableName, rowCount);

          set((state) =>
            produce(state, (draft) => {
              draft.project.dataSourceStates[tableName] = {
                status: DataSourceStatus.READY,
              };
            }),
          );
        } catch (err) {
          set((state) =>
            produce(state, (draft) => {
              draft.project.dataSourceStates[ds.tableName] = {
                status: DataSourceStatus.ERROR,
                message:
                  err instanceof DuckQueryError
                    ? err.getMessageForUser()
                    : `${err}`,
              };
            }),
          );
          // TODO: Make sure the errors are shown
        }
      }
      await get().project.setTables(await get().project.refreshTableSchemas());
    }

    async function updateTables(): Promise<DataTable[]> {
      const {connector} = get().duckdb;
      const tables = await connector.getTableSchemas();
      await get().project.setTables(tables);
      return tables;
    }
  };

  return slice;
}
