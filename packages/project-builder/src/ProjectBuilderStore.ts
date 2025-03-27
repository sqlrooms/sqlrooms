import {
  DataTable,
  DuckDbSliceState,
  LoadFileOptions,
  createDuckDbSlice,
} from '@sqlrooms/duckdb';
import {makeMosaicStack, removeMosaicNodeByKey} from '@sqlrooms/layout';
import {
  createProjectSlice,
  ProjectState,
  ProjectStateActions,
  ProjectStateContext,
  ProjectStateProps,
} from '@sqlrooms/project';
import {
  BaseProjectConfig,
  DEFAULT_MOSAIC_LAYOUT,
  DataSource,
  DataSourceTypes,
  FileDataSource,
  LayoutConfig,
  MAIN_VIEW,
  SqlQueryDataSource,
  UrlDataSource,
  isMosaicLayoutParent,
} from '@sqlrooms/project-config';

import {ErrorBoundary} from '@sqlrooms/ui';
import {
  ProgressInfo,
  convertToUniqueColumnOrTableName,
  convertToValidColumnOrTableName,
  downloadFile,
} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {castDraft, produce} from 'immer';
import {ReactNode, useContext} from 'react';
import {StateCreator, StoreApi, useStore} from 'zustand';
import {
  DataSourceState,
  DataSourceStatus,
  ProjectFileInfo,
  ProjectFileState,
} from './types';

export type TaskProgress = {
  progress?: number | undefined;
  message: string;
};

const INIT_DB_TASK = 'init-db';
const INIT_PROJECT_TASK = 'init-project';
const DOWNLOAD_DATA_SOURCES_TASK = 'download-data-sources';

export type ProjectBuilderStore<PC extends BaseProjectConfig> = StoreApi<
  ProjectBuilderState<PC>
>;

export type ProjectPanelInfo = {
  title: string;
  icon: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'main' | 'top-bar';
};

export const INITIAL_PROJECT_BUILDER_STATE: Omit<
  ProjectBuilderStateProps<BaseProjectConfig>,
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
  layout: DEFAULT_MOSAIC_LAYOUT,
};

export type ProjectBuilderStateProps<PC extends BaseProjectConfig> =
  ProjectStateProps<PC> & {
    schema: string;
    tasksProgress: Record<string, TaskProgress>;
    projectId: string | undefined; // undefined if the project is new
    panels: Record<string, ProjectPanelInfo>;
    isReadOnly: boolean;
    tables: DataTable[];
    projectFiles: ProjectFileInfo[];
    projectFilesProgress: {[pathname: string]: ProjectFileState};
    lastSavedConfig: PC | undefined;
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

export type ProjectBuilderStateActions<PC extends BaseProjectConfig> =
  ProjectStateActions<PC> & {
    /**
     * Initialize the project state.
     * @returns A promise that resolves when the project state has been initialized.
     */
    initialize: () => Promise<void>;
    setTaskProgress: (
      id: string,
      taskProgress: TaskProgress | undefined,
    ) => void;
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
    /**
     * Set the layout of the project.
     * @param layout - The layout to set.
     */
    setLayout(layout: LayoutConfig): void;
    /**
     * Toggle a panel.
     * @param panel - The panel to toggle.
     * @param show - Whether to show the panel.
     */
    togglePanel: (panel: string, show?: boolean) => void;
    /**
     * Toggle the pin state of a panel.
     * @param panel - The panel to toggle the pin state of.
     */
    togglePanelPin: (panel: string) => void;
    /**
     * Add or update a SQL query data source.
     * @param tableName - The name of the table to create or update.
     * @param query - The SQL query to execute.
     * @param oldTableName - The name of the table to replace (optional).
     */
    addOrUpdateSqlQueryDataSource(
      tableName: string,
      query: string,
      oldTableName?: string,
    ): Promise<void>;
    removeSqlQueryDataSource(tableName: string): Promise<void>;

    addProjectFile(
      file: File | string,
      tableName?: string,
      loadFileOptions?: LoadFileOptions,
    ): Promise<DataTable | undefined>;
    removeProjectFile(pathname: string): void;
    maybeDownloadDataSources(): Promise<void>;
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

export type ProjectBuilderState<PC extends BaseProjectConfig> =
  ProjectState<PC> & {
    config: PC;
    project: ProjectBuilderStateProps<PC> & ProjectBuilderStateActions<PC>;
  } & DuckDbSliceState;

/**
 * 	This type takes a union type U (for example, A | B) and transforms it into an intersection type (A & B). This is useful because if you pass in, say, two slices of type { a: number } and { b: string }, the union of the slice types would be { a: number } | { b: string }, but you really want an object that has both properties—i.e. { a: number } & { b: string }.
 */
type InitialState<PC extends BaseProjectConfig> = {
  config: Omit<PC, keyof BaseProjectConfig> & Partial<BaseProjectConfig>;
  project: Partial<Omit<ProjectBuilderStateProps<PC>, 'config' | 'panels'>> & {
    panels: ProjectBuilderStateProps<PC>['panels'];
  };
};

export function createProjectBuilderSlice<PC extends BaseProjectConfig>(
  props: InitialState<PC>,
): StateCreator<ProjectBuilderState<PC>> {
  const {config: configProps, project: projectStateProps, ...restState} = props;
  const initialConfig: PC = {
    ...INITIAL_BASE_PROJECT_CONFIG,
    ...configProps,
  } as PC;
  const initialProjectState: ProjectBuilderStateProps<PC> = {
    ...INITIAL_PROJECT_BUILDER_STATE,
    ...projectStateProps,
    schema: projectStateProps.schema ?? INITIAL_PROJECT_BUILDER_STATE.schema,
    lastSavedConfig: undefined,
  };

  const slice: StateCreator<ProjectBuilderState<PC>> = (set, get, store) => {
    const projectSliceState = createProjectSlice({
      config: initialConfig,
      project: initialProjectState,
    })(set, get, store);
    const projectState: ProjectBuilderState<PC> = {
      ...projectSliceState,
      ...createDuckDbSlice({})(set, get, store),
      project: {
        ...initialProjectState,
        ...projectSliceState.project,
        async initialize() {
          projectSliceState.project.initialize();
          const {setTaskProgress} = get().project;
          setTaskProgress(INIT_DB_TASK, {
            message: 'Initializing database…',
            progress: undefined,
          });
          await get().db.initialize();
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

        addDataSource: async (
          dataSource,
          status = DataSourceStatus.PENDING,
        ) => {
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
          const table = tables.find((t) => t.tableName === tableName);
          if (table) {
            return table;
          }

          const {db} = get();
          if (data instanceof arrow.Table) {
            await db.connector.loadArrow(data, tableName);
          } else {
            await db.connector.loadObjects(data, tableName);
          }
          const newTable = await db.getTableSchema(tableName);

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
          const {db} = get();
          const newTableName =
            tableName !== oldTableName
              ? convertToUniqueColumnOrTableName(
                  tableName,
                  await db.getTables(schema),
                )
              : tableName;
          const {rowCount} = await db.createTableFromQuery(newTableName, query);
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
          await get().project.setTables(await db.getTableSchemas());
        },

        removeSqlQueryDataSource: async (tableName) => {
          const {db} = get();
          await db.dropTable(tableName);
          set((state) =>
            produce(state, (draft) => {
              draft.config.dataSources = draft.config.dataSources.filter(
                (d) => d.tableName !== tableName,
              );
              delete draft.project.dataSourceStates[tableName];
            }),
          );
          await get().project.setTables(await db.getTableSchemas());
        },

        setProjectFiles: (projectFiles) =>
          set((state) =>
            produce(state, (draft) => {
              draft.project.projectFiles = projectFiles;
            }),
          ),

        async addProjectFile(file, desiredTableName, loadOptions) {
          const {db} = get();

          const pathname = file instanceof File ? file.name : file;
          const tableName =
            desiredTableName ?? convertToValidColumnOrTableName(pathname);

          await db.connector.loadFile(file, tableName, loadOptions);

          // This must come before addDataSource, as addDataSource can trigger
          // download which also adds the file
          set((state) =>
            produce(state, (draft) => {
              draft.project.projectFiles.push({
                pathname,
                duckdbFileName: pathname,
                size: file instanceof File ? file.size : undefined,
                file: file instanceof File ? file : undefined,
              });
            }),
          );
          await get().project.addDataSource(
            {
              type: DataSourceTypes.enum.file,
              fileName: pathname,
              tableName,
            },
            // duckdbFileName ? DataSourceStatus.READY : DataSourceStatus.PENDING,
            DataSourceStatus.READY,
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
          set((state) =>
            produce(state, (draft) => {
              draft.project.projectFiles = draft.project.projectFiles.filter(
                (f) => f.pathname !== pathname,
              );
              draft.config.dataSources = draft.config.dataSources.filter(
                (d) =>
                  d.type !== DataSourceTypes.Enum.file ||
                  d.fileName !== pathname,
              );
            }),
          );
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
              dataSourceStates[ds.tableName]?.status ===
                DataSourceStatus.PENDING,
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
        setLayout: (layout) =>
          set((state) =>
            produce(state, (draft) => {
              draft.config.layout = layout;
            }),
          ),

        togglePanel: (panel, show) => {
          const {config} = get();
          if (config.layout?.nodes === panel) {
            // don't hide the view if it's the only one
            return;
          }
          const result = removeMosaicNodeByKey(config.layout?.nodes, panel);
          const isShown = result.success;
          if (isShown) {
            if (show || panel === MAIN_VIEW /*&& areViewsReadyToRender()*/) {
              return;
            }
            set((state) =>
              produce(state, (draft) => {
                const layout = draft.config.layout;
                layout.nodes = result.nextTree;
                if (layout.pinned?.includes(panel)) {
                  layout.pinned = layout.pinned.filter((p) => p !== panel);
                }
              }),
            );
          } else {
            if (show === false) {
              return;
            }
            set((state) =>
              produce(state, (draft) => {
                const layout = draft.config.layout;
                const root = layout.nodes;
                const placement = draft.project.panels[panel]?.placement;
                const side = placement === 'sidebar' ? 'first' : 'second';
                const toReplace = isMosaicLayoutParent(root)
                  ? root[side]
                  : undefined;
                if (
                  toReplace &&
                  isMosaicLayoutParent(root) &&
                  !isMosaicLayoutParent(toReplace) &&
                  toReplace !== MAIN_VIEW &&
                  !layout.fixed?.includes(toReplace) &&
                  !layout.pinned?.includes(toReplace)
                ) {
                  // replace first un-pinned leaf
                  root[side] = panel;
                } else {
                  const panelNode = {node: panel, weight: 1};
                  const restNode = {
                    node: config.layout?.nodes,
                    weight: 3,
                  };
                  // add to to the left
                  layout.nodes = makeMosaicStack(
                    placement === 'sidebar-bottom' ? 'column' : 'row',
                    side === 'first'
                      ? [panelNode, restNode]
                      : [restNode, panelNode],
                  );
                }
              }),
            );
          }
        },

        /**
         * Toggle the pin state of a panel.
         * @param panel - The panel to toggle the pin state of.
         */
        togglePanelPin: (panel: string) => {
          set((state) =>
            produce(state, (draft) => {
              const layout = draft.config.layout;
              const pinned = layout.pinned ?? [];
              if (pinned.includes(panel)) {
                layout.pinned = pinned.filter((p) => p !== panel);
              } else {
                layout.pinned = [...pinned, panel];
              }
            }),
          );
        },

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
          const tables = await get().db.getTableSchemas();
          await get().project.setTables(tables);
          return tables;
        },
      },
      ...restState,
    };

    return projectState;

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
            const {db} = get();
            await db.connector.loadFile(
              new File([downloadedFile], fileName),
              ds.tableName,
            );
            setTableRowCount(
              ds.tableName,
              await db.getTableRowCount(ds.tableName),
            );
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
        await setTables(await get().db.getTableSchemas());
      }
    }

    async function runDataSourceQueries(queries: SqlQueryDataSource[]) {
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
          const {rowCount} = await get().db.createTableFromQuery(
            tableName,
            sqlQuery,
          );
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
                message: `${err}`,
              };
            }),
          );
          // TODO: Make sure the errors are shown
        }
      }
      await get().project.setTables(await get().db.getTableSchemas());
    }

    async function updateTables(): Promise<DataTable[]> {
      const tables = await get().db.getTableSchemas();
      await get().project.setTables(tables);
      return tables;
    }
  };

  return slice;
}

export function useBaseProjectBuilderStore<
  PC extends BaseProjectConfig,
  PS extends ProjectBuilderState<PC>,
  T,
>(selector: (state: ProjectBuilderState<PC>) => T): T {
  const store = useContext(ProjectStateContext);
  if (!store) {
    throw new Error('Missing ProjectStateProvider in the tree');
  }
  return useStore(store as unknown as StoreApi<PS>, selector);
}

export function createSlice<PC extends BaseProjectConfig, S>(
  sliceCreator: (
    ...args: Parameters<StateCreator<S & ProjectBuilderState<PC>>>
  ) => S,
): StateCreator<S> {
  return (set, get, store) =>
    sliceCreator(
      set,
      get as () => S & ProjectBuilderState<PC>,
      store as StoreApi<S & ProjectBuilderState<PC>>,
    );
}
