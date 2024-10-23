import {
  DataTable,
  DuckQueryError,
  createTableFromQuery,
  createViewFromFile,
  createViewFromRegisteredFile,
  dropAllFiles,
  dropAllTables,
  dropFile,
  dropTable,
  getDuckTableSchema,
  getDuckTableSchemas,
  getDuckTables,
} from '@sqlrooms/duckdb';
import {makeMosaicStack, removeMosaicNodeByKey} from '@sqlrooms/layout';
import {
  BaseProjectConfig,
  BaseViewConfig,
  DEFAULT_MOSAIC_LAYOUT,
  DEFAULT_PROJECT_TITLE,
  DataSource,
  DataSourceTypes,
  FileDataSource,
  LayoutConfig,
  ProjectPanelTypes,
  SqlQueryDataSource,
  UrlDataSource,
  isMosaicLayoutParent,
} from '@sqlrooms/project-config';
import {
  ProgressInfo,
  convertToUniqueColumnOrTableName,
  convertToUniqueS3FolderPath,
  downloadFile,
  generateUniqueName,
  getSignedFileUrl,
  splitFilePath,
} from '@sqlrooms/utils';
import {clearMosaicPlotConn, getMosaicPlotConn} from '@sqlrooms/vgplot';
import {loadObjects} from '@uwdata/mosaic-sql';
import {produce} from 'immer';
import {StateCreator, StoreApi, create} from 'zustand';
import {
  DataSourceState,
  DataSourceStatus,
  ProjectFileInfo,
  ProjectFileState,
} from './types';

export type ViewState<VC extends BaseViewConfig> = {
  config: VC;
  onDataUpdated: () => void;
  readyToRender: boolean;
};
export type TaskProgress = {
  progress?: number | undefined;
  message: string;
};

const INIT_PROJECT_TASK = 'init-project';
const DOWNLOAD_DATA_SOURCES_TASK = 'download-data-sources';

export type ViewStore<VC extends BaseViewConfig> = StoreApi<ViewState<VC>>;

type ElementType<T> = T extends (infer U)[] ? U : never;

export type ProjectStore<PC extends BaseProjectConfig> = ReturnType<
  typeof createProjectStore<PC>
>;

export type ViewStoreFactory<PC extends BaseProjectConfig> = (
  projectStore: ProjectState<PC>,
  viewConfig: ElementType<PC['views']>,
) => ViewStore<ElementType<PC['views']>>;

export type ViewStoreFactories<PC extends BaseProjectConfig> = {
  [viewId: string]: ViewStoreFactory<PC>;
};

export type CreateProjectStoreProps<PC extends BaseProjectConfig> = {
  initialState: Partial<ProjectStateProps<PC>> &
    Required<Pick<ProjectStateProps<PC>, 'projectConfig'>>;
  schema?: string;
  viewStoreFactories?: ViewStoreFactories<PC>;
};

export type ProjectPanelInfo = {
  title: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  placement: 'sidebar' | 'sidebar-bottom' | 'hidden' | 'top-bar';
};

export const INITIAL_BASE_PROJECT_STATE: Omit<
  ProjectStateProps<BaseProjectConfig>,
  'projectConfig' | 'lastSavedConfig' | 'projectPanels'
> = {
  schema: 'main',
  tasksProgress: {},
  projectId: undefined,
  password: undefined,
  projectFolder: undefined,
  initialized: false,
  isDataAvailable: false,
  isReadOnly: false,
  isPublic: false,
  viewStores: {},
  projectFiles: [],
  projectFilesProgress: {},
  // userId: undefined,
  tables: [],
  tableRowCounts: {},
  dataSourceStates: {},
  captureException(exception: any) {
    console.error(exception);
  },
};

export const INITIAL_BASE_PROJECT_CONFIG: BaseProjectConfig = {
  title: '',
  description: '',
  dataSources: [],
  views: [],
  layout: DEFAULT_MOSAIC_LAYOUT,
};

export type ViewStores<PC extends BaseProjectConfig> = {
  [key: string]: {
    viewStore: ViewStore<ElementType<PC['views']>>;
    unsubscribe: () => void;
  };
};

export type ProjectStateProps<PC extends BaseProjectConfig> = {
  schema: string;
  tasksProgress: Record<string, TaskProgress>;
  projectId: string | undefined; // undefined if the project is new
  password: string | undefined; // Password for protected published projects (needs to be sent to get access to data)
  projectFolder: string | undefined; // will be derived from project title, if not explicitly set
  projectConfig: PC;
  projectPanels: Record<ProjectPanelTypes | string, ProjectPanelInfo>;
  isPublic: boolean;
  isReadOnly: boolean;
  tables: DataTable[];
  projectFiles: ProjectFileInfo[];
  projectFilesProgress: {[pathname: string]: ProjectFileState};
  lastSavedConfig: PC | undefined;
  initialized: boolean; // Whether the project has been initialized so we can render UI
  isDataAvailable: boolean; // Whether the data has been loaded (on initialization)
  dataSourceStates: {[tableName: string]: DataSourceState}; // TODO
  tableRowCounts: {[tableName: string]: number};
  viewStores: ViewStores<PC>;
  captureException: (exception: any, captureContext?: any) => void;
};

export type ProjectStateActions<PC extends BaseProjectConfig> = {
  setTaskProgress: (id: string, taskProgress: TaskProgress | undefined) => void;
  getLoadingProgress: () => TaskProgress | undefined;
  reset: () => Promise<void>;
  reinitialize: (opts?: {
    project?: {id?: string; config: PC};
    isReadOnly?: boolean;
    isPublic?: boolean;
    password?: string;
    captureException?: (exception: any, captureContext?: any) => void;
  }) => Promise<void>;
  setProjectConfig: (config: PC) => void;
  setProjectId: (projectId: string | undefined) => void;
  setProjectFolder: (projectFolder: string) => void;
  getProjectFolder: () => string;
  setLastSavedConfig: (config: PC) => void;
  hasUnsavedChanges(): boolean; // since last save
  setLayout(layout: LayoutConfig): void;
  togglePanel: (panel: string, show?: boolean) => void;
  togglePanelPin: (panel: string) => void;
  addOrUpdateSqlQuery(
    tableName: string,
    query: string,
    oldTableName?: string,
  ): Promise<void>;
  removeSqlQueryDataSource(tableName: string): void;
  addProjectFile(info: ProjectFileInfo, desiredTableName?: string): void;
  removeProjectFile(pathname: string): void;
  maybeDownloadDataSources(): Promise<void>;
  setProjectFiles(info: ProjectFileInfo[]): void;
  setProjectFileProgress(pathname: string, fileState: ProjectFileState): void;
  addDataSource: (dataSource: DataSource, status?: DataSourceStatus) => void;
  getTable(tableName: string): DataTable | undefined;
  addTable(tableName: string, data: Record<string, any>[]): Promise<DataTable>;
  setTables(dataTable: DataTable[]): void;
  setTableRowCount(tableName: string, rowCount: number): void;
  setProjectTitle(title: string): void;
  setDescription(description: string): void;
  getViewStore(viewId: string): ViewStore<ElementType<PC['views']>> | undefined;
  addView: (view: ElementType<PC['views']>) => void;
  removeView: (viewId: string) => void;
  areDatasetsReady(): boolean;
  areViewsReadyToRender(): boolean;
};

export type ProjectState<PC extends BaseProjectConfig> = ProjectStateProps<PC> &
  ProjectStateActions<PC>;

export function createProjectStore<PC extends BaseProjectConfig>(
  props: CreateProjectStoreProps<PC>,
) {
  const initialState: ProjectStateProps<PC> = {
    ...INITIAL_BASE_PROJECT_STATE,
    ...props.initialState,
    projectConfig: {
      INITIAL_BASE_PROJECT_CONFIG,
      ...props.initialState.projectConfig,
    },
    projectPanels: {
      ...props.initialState.projectPanels,
    },
    lastSavedConfig: undefined,
  };

  const store: StateCreator<ProjectState<PC>> = (set, get) => {
    const projectState: ProjectState<PC> = {
      ...initialState,

      reset: async () => {
        const {viewStores, removeView} = get();
        for (const viewId of Object.keys(viewStores)) {
          removeView(viewId);
        }
        set(initialState);
        try {
          // Clean up DuckDB
          await Promise.all([dropAllFiles(), dropAllTables()]);
          await clearMosaicPlotConn();
        } catch (err) {
          console.error(err);
        }
      },

      reinitialize: async (opts) => {
        const {
          project,
          isPublic = false,
          isReadOnly = false,
          captureException,
          password,
        } = opts ?? {};
        await get().reset();

        // Remove and unsubscribe from all views
        // TODO: show some error message if the project config is invalid
        const projectConfig = project?.config ?? initialState.projectConfig;

        set({
          ...initialState,
          projectId: project?.id ?? undefined,
          isPublic,
          isReadOnly,
          projectConfig,
          lastSavedConfig: projectConfig,
          captureException: captureException ?? console.error,
          password,
          initialized: true,
          isDataAvailable: false,
        });

        const {addView} = get();
        for (const view of projectConfig.views) {
          addView(view as ElementType<PC['views']>);
        }

        get().setTaskProgress(INIT_PROJECT_TASK, {
          message: 'Initializing project…',
          progress: undefined,
        });
        await updateReadyDataSources();
        await get().maybeDownloadDataSources();
        get().setTaskProgress(INIT_PROJECT_TASK, undefined);
        set({isDataAvailable: true})
      },

      setTaskProgress(id, taskProgress) {
        set((state) =>
          produce(state, (draft) => {
            if (taskProgress) {
              draft.tasksProgress[id] = taskProgress;
            } else {
              delete draft.tasksProgress[id];
            }
          }),
        );
      },

      /** Returns the progress of the last task */
      getLoadingProgress() {
        const {tasksProgress} = get();
        const keys = Object.keys(tasksProgress);
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
          return tasksProgress[lastKey];
        }
        return undefined;
      },

      // setUserId: (userId) => set(() => ({userId})),
      setProjectId: (projectId) => set(() => ({projectId})),
      setProjectConfig: (config) => set(() => ({projectConfig: config})),
      setLastSavedConfig: (config) => set(() => ({lastSavedConfig: config})),

      hasUnsavedChanges: () => {
        const {projectConfig, lastSavedConfig} = get();
        return projectConfig !== lastSavedConfig;
      },

      getViewStore(viewId) {
        return get().viewStores[viewId]?.viewStore;
      },

      addView(view) {
        const viewId = view.id;
        if (get().viewStores[viewId]) {
          console.log(`View with id ${viewId} already exists`);
          return;
        }
        const createViewStore = props?.viewStoreFactories?.[view.type];
        if (!createViewStore) {
          throw new Error(`No factory for view type: ${view.type}`);
        }
        const viewStore = createViewStore(get(), view);

        // TODO: Consider using monolithic store which custom set functions
        //       for child objects to avoid having to manage subscriptions
        // See https://github.com/pmndrs/zustand/issues/163#issuecomment-678821969
        // Listen to changes in the view store and update the project config
        const unsubscribe = viewStore.subscribe(({config}) => {
          set((state) =>
            produce(state, (draft) => {
              const views = draft.projectConfig.views;
              const index = views.findIndex(({id}) => id === viewId);
              views[index >= 0 ? index : views.length] = config;
            }),
          );
        });
        set((state) =>
          produce(state, (draft) => {
            draft.viewStores[viewId] = {viewStore, unsubscribe};
          }),
        );
      },

      removeView(viewId) {
        set((state) =>
          produce(state, (draft) => {
            const viewStore = draft.viewStores[viewId];
            if (viewStore) {
              viewStore.unsubscribe();
              delete draft.viewStores[viewId];
              draft.projectConfig.views = draft.projectConfig.views.filter(
                ({id}) => id !== viewId,
              );
            }
          }),
        );
      },

      addDataSource: (dataSource, status = DataSourceStatus.PENDING) => {
        set((state) =>
          produce(state, (draft) => {
            const dataSources = draft.projectConfig.dataSources;
            const tableName = dataSource.tableName;
            const index = dataSources.findIndex(
              (d) => d.tableName === tableName,
            );
            if (index >= 0) {
              dataSources[index] = dataSource;
            } else {
              dataSources.push(dataSource);
            }
            draft.dataSourceStates[tableName] = {status};
          }),
        );
        get().maybeDownloadDataSources();
      },

      setProjectFolder: (projectFolder) =>
        set((state) =>
          produce(state, (draft) => {
            // let path = convertToValidS3FolderPath(projectFolder).trim();
            // path = path.replace(/\/+/g, '/');
            // if (path === '/') path = '';
            draft.projectFolder = projectFolder;
          }),
        ),

      getProjectFolder() {
        const {
          projectFolder,
          projectConfig: {title},
        } = get();
        return (
          projectFolder ??
          convertToUniqueS3FolderPath(title || DEFAULT_PROJECT_TITLE)
        );
      },

      addOrUpdateSqlQuery: async (tableName, query, oldTableName) => {
        const {schema} = get();
        const newTableName =
          tableName !== oldTableName
            ? generateUniqueName(tableName, await getDuckTables(schema))
            : tableName;
        const {rowCount} = await createTableFromQuery(newTableName, query);
        get().setTableRowCount(newTableName, rowCount);
        set((state) =>
          produce(state, (draft) => {
            const newDataSource = {
              type: DataSourceTypes.enum.sql,
              sqlQuery: query,
              tableName: newTableName,
            };
            if (oldTableName) {
              draft.projectConfig.dataSources =
                draft.projectConfig.dataSources.map((dataSource) =>
                  dataSource.tableName === oldTableName
                    ? newDataSource
                    : dataSource,
                );
              delete draft.dataSourceStates[oldTableName];
            } else {
              draft.projectConfig.dataSources.push(newDataSource);
            }
            draft.dataSourceStates[newTableName] = {
              status: DataSourceStatus.READY,
            };
          }),
        );
        get().setTables(await getDuckTableSchemas());
      },

      removeSqlQueryDataSource: async (tableName) => {
        await dropTable(tableName);
        set((state) =>
          produce(state, (draft) => {
            draft.projectConfig.dataSources =
              draft.projectConfig.dataSources.filter(
                (d) => d.tableName !== tableName,
              );
            delete draft.dataSourceStates[tableName];
          }),
        );
        get().setTables(await getDuckTableSchemas());
      },

      setProjectFiles: (projectFiles) => set(() => ({projectFiles})),

      async addProjectFile(projectFile, desiredTableName) {
        const {duckdbFileName, pathname} = projectFile;
        if (get().projectFiles.some((f) => f.pathname === pathname)) {
          return;
        }
        const {name} = splitFilePath(pathname);
        const tableName =
          desiredTableName ??
          convertToUniqueColumnOrTableName(name, await getDuckTables());
        if (duckdbFileName) {
          const {rowCount} = await createViewFromRegisteredFile(
            duckdbFileName,
            'main',
            tableName,
          );
          get().setTableRowCount(tableName, rowCount);
        }
        // This must come before addDataSource, as addDataSource can trigger
        // download which also adds the file
        set((state) =>
          produce(state, (draft) => {
            draft.projectFiles.push(projectFile);
          }),
        );
        // TODO: pass rowCount to setTables?
        get().addDataSource(
          {
            type: DataSourceTypes.enum.file,
            fileName: pathname,
            tableName,
          },
          Boolean(duckdbFileName)
            ? DataSourceStatus.READY
            : DataSourceStatus.PENDING,
        );
        get().setTables(await getDuckTableSchemas());
      },
      removeProjectFile(pathname) {
        set((state) =>
          produce(state, (draft) => {
            draft.projectFiles = draft.projectFiles.filter(
              (f) => f.pathname !== pathname,
            );
            draft.projectConfig.dataSources =
              draft.projectConfig.dataSources.filter(
                (d) =>
                  d.type !== DataSourceTypes.Enum.file ||
                  d.fileName !== pathname,
              );
          }),
        );
        dropFile(pathname);
      },

      setProjectFileProgress(pathname, fileState) {
        set((state) =>
          produce(state, (draft) => {
            draft.projectFilesProgress[pathname] = fileState;
            // Update the file size in the project config from the progress info
            const fileInfo = draft.projectFiles.find(
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
        const {projectFilesProgress, dataSourceStates, projectConfig} = get();
        const {dataSources} = projectConfig;
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
        ) as SqlQueryDataSource[];

        if (queriesToRun.length > 0) {
          await runDataSourceQueries(queriesToRun);
        }

        // await create
      },

      setTableRowCount: (tableName, rowCount) =>
        set((state) =>
          produce(state, (draft) => {
            draft.tableRowCounts[tableName] = rowCount;
          }),
        ),

      getTable(tableName) {
        return get().tables.find((t) => t.tableName === tableName);
      },

      /** Currently only used by the SDK to support adding data directly */
      async addTable(tableName, data) {
        const {tables} = get();
        const table = tables.find((t) => t.tableName === tableName);
        if (table) {
          return table;
        }

        const {coordinator} = await getMosaicPlotConn();
        await coordinator.exec(loadObjects(tableName, data));
        const newTable = await getDuckTableSchema(tableName);

        set((state) =>
          produce(state, (draft) => {
            draft.tables.push(newTable);
          }),
        );
        updateReadyDataSources();
        return newTable;
      },

      setTables: (tables) => {
        console.log(new Error().stack)
        set({tables});
        updateReadyDataSources();
      },

      setProjectTitle: (title) =>
        set((state) =>
          produce(state, (draft) => {
            draft.projectConfig.title = title;
          }),
        ),

      setDescription: (description) =>
        set((state) =>
          produce(state, (draft) => {
            draft.projectConfig.description = description;
          }),
        ),
      setLayout: (layout) =>
        set((state) =>
          produce(state, (draft) => {
            draft.projectConfig.layout = layout;
          }),
        ),

      togglePanel: (panel, show) => {
        const {projectConfig, areViewsReadyToRender} = get();
        if (projectConfig.layout?.nodes === panel) {
          // don't hide the view if it's the only one
          return;
        }
        const result = removeMosaicNodeByKey(
          projectConfig.layout?.nodes,
          panel,
        );
        const isShown = result.success;
        if (isShown) {
          if (
            show ||
            (panel === ProjectPanelTypes.MAIN_VIEW && areViewsReadyToRender())
          ) {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              const layout = draft.projectConfig.layout;
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
              const layout = draft.projectConfig.layout;
              const root = layout.nodes;
              const placement = draft.projectPanels[panel]?.placement;
              const side = placement === 'sidebar' ? 'first' : 'second';
              const toReplace = isMosaicLayoutParent(root)
                ? root[side]
                : undefined;
              if (
                toReplace &&
                isMosaicLayoutParent(root) &&
                !isMosaicLayoutParent(toReplace) &&
                toReplace !== ProjectPanelTypes.MAIN_VIEW &&
                !layout.fixed?.includes(toReplace) &&
                !layout.pinned?.includes(toReplace)
              ) {
                // replace first un-pinned leaf
                root[side] = panel;
              } else {
                const panelNode = {node: panel, weight: 1};
                const restNode = {
                  node: projectConfig.layout?.nodes,
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

      togglePanelPin: (panel) => {
        set((state) =>
          produce(state, (draft) => {
            const layout = draft.projectConfig.layout;
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
        const {projectConfig, dataSourceStates} = get();
        const dataSources = projectConfig.dataSources;
        return dataSources.every(
          (ds) =>
            dataSourceStates[ds.tableName]?.status === DataSourceStatus.READY,
        );
      },

      areViewsReadyToRender: () => {
        const {viewStores} = get();
        const stores = Object.values(viewStores);
        if (stores.length === 0) {
          return false;
        }
        return stores.every(
          ({viewStore}) => viewStore.getState().readyToRender,
        );
      },
    };
    return projectState;

    /**
     * Update the status of all data sources based on the current tables.
     */
    function updateReadyDataSources() {
      const {projectConfig, tables, dataSourceStates} = get();
      const dataSources = projectConfig.dataSources;
      set({
        dataSourceStates: dataSources.reduce(
          (acc, ds) => {
            const tableName = ds.tableName;
            const table = tables.find((t) => t.tableName === tableName);
            acc[tableName] = {
              status: table
                ? DataSourceStatus.READY
                : // Don't change the existing status which could be ERROR or PENDING
                  dataSourceStates[tableName]?.status ??
                  DataSourceStatus.PENDING,
            };
            return acc;
          },
          {...dataSourceStates},
        ),
      });

      const {viewStores} = get();
      for (const view of Object.values(viewStores)) {
        view.viewStore.getState().onDataUpdated();
      }
    }

    function updateTotalFileDownloadProgress() {
      const {projectFilesProgress, setTaskProgress} = get();
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
        isPublic: isPublicProject,
        projectId,
        password,
        setProjectFileProgress,
        setTableRowCount,
        setTables,
        captureException,
        setTaskProgress,
      } = get();
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
            const index = draft.projectFiles.findIndex(
              (f) => f.pathname === fileName,
            );
            if (index >= 0) {
              draft.projectFiles[index] = info;
            } else {
              draft.projectFiles.push(info);
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
            const url =
              ds.type === DataSourceTypes.Enum.file
                ? await getSignedFileUrl(
                    isPublicProject
                      ? {
                          projectId,
                          fname: fileName,
                          upload: false,
                          password,
                        }
                      : {fname: fileName, upload: false},
                  )
                : ds.url;
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
            // Make sure the errors are shown
            get().togglePanel(ProjectPanelTypes.DATA_SOURCES, true);
          } finally {
            setTaskProgress(DOWNLOAD_DATA_SOURCES_TASK, undefined);
          }
        }),
      );
      if (loadedFiles.length) {
        setTables(await getDuckTableSchemas());
      }
    }

    async function runDataSourceQueries(queries: SqlQueryDataSource[]) {
      for (const ds of queries) {
        try {
          const {tableName, sqlQuery} = ds;
          set((state) =>
            produce(state, (draft) => {
              draft.dataSourceStates[tableName] = {
                status: DataSourceStatus.FETCHING,
              };
            }),
          );
          const {rowCount} = await createTableFromQuery(tableName, sqlQuery);
          get().setTableRowCount(tableName, rowCount);
          set((state) =>
            produce(state, (draft) => {
              draft.dataSourceStates[tableName] = {
                status: DataSourceStatus.READY,
              };
            }),
          );
        } catch (err) {
          set((state) =>
            produce(state, (draft) => {
              draft.dataSourceStates[ds.tableName] = {
                status: DataSourceStatus.ERROR,
                message:
                  err instanceof DuckQueryError
                    ? err.getMessageForUser()
                    : `${err}`,
              };
            }),
          );
          // Make sure the errors are shown
          get().togglePanel(ProjectPanelTypes.DATA_SOURCES, true);
        }
      }
      get().setTables(await getDuckTableSchemas());
    }
  };

  return create<ProjectState<PC>>()(store);
}
