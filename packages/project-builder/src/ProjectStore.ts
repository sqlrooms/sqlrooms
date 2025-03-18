import {
  DataTable,
  DuckDbConnector,
  DuckQueryError,
  createTableFromArrowTable,
  createTableFromObjects,
  createTableFromQuery,
  createViewFromFile,
  createViewFromRegisteredFile,
  dropFile,
  dropTable,
  getDuckDb,
  getDuckTableSchema,
  getDuckTableSchemas,
  getDuckTables,
} from '@sqlrooms/duckdb';
import {makeMosaicStack, removeMosaicNodeByKey} from '@sqlrooms/layout';
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
  downloadFile,
  splitFilePath,
} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {castDraft, produce} from 'immer';
import {ReactNode} from 'react';
import {StateCreator, StoreApi, createStore} from 'zustand';
import {useBaseProjectStore} from './ProjectStateProvider';
import {
  DataSourceState,
  DataSourceStatus,
  ProjectFileInfo,
  ProjectFileState,
} from './types';
import {processDroppedFile} from './utils/processDroppedFiles';

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
  duckDbConnector: undefined as unknown as DuckDbConnector, // Will be initialized during project initialization
};

export const INITIAL_BASE_PROJECT_CONFIG: BaseProjectConfig = {
  title: '',
  description: '',
  dataSources: [],
  layout: DEFAULT_MOSAIC_LAYOUT,
};

export type ProjectStateProps<PC extends BaseProjectConfig> = {
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
  duckDbConnector: DuckDbConnector;
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
  replaceProjectFile(
    projectFile: ProjectFileInfo,
  ): Promise<DataTable | undefined>;
  addProjectFile(
    info: File | ProjectFileInfo,
    desiredTableName?: string,
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

export type ProjectState<PC extends BaseProjectConfig> = {
  config: PC;
  project: ProjectStateProps<PC> & ProjectStateActions<PC>;
};

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
  duckDbConnector?: DuckDbConnector;
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

  // if (import.meta.hot) {
  //   console.log('yep');
  //   projectStore.subscribe((state) => {
  //     if (typeof window !== 'undefined') {
  //       window.__store = state;
  //     }
  //   });
  //   import.meta.hot!.accept((newModule) => {
  //     console.log('yep update');
  //     if (!newModule) return;
  //     const newStore = newModule.useStore;
  //     if (!newStore) return;
  //     if (window.__store) {
  //       newStore.setState(window.__store, true);
  //     }
  //   });
  // }
  return {projectStore, useProjectStore};
}

// // If you have `StateCreator<S>` = (set, get, store) => S
// // we want to extract that S:
// type ExtractSliceState<SC> = SC extends (...args: any[]) => infer R ? R : never;

// /**
//  * Convert a union type A|B|C into an intersection A & B & C
//  * e.g. UnionToIntersection<{ a: number } | { b: string }>
//  *               -> { a: number, b: string }
//  */
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;

// export function createProjectStore<
//   PC extends BaseProjectConfig,
//   // "Creators" is now an array of whatever `createSlice<PC, S>` returns
//   // which should be `StateCreator<S>`.
//   Creators extends Array<
//     ReturnType<typeof createSlice<PC, any>>
//   > = any[],
// >(initialState: InitialState<PC>, ...sliceCreators: Creators) {
//   //
//   // 1) Figure out the intersection of all slice return types
//   //
//   type CombinedSlices = UnionToIntersection<
//     ExtractSliceState<Creators[number]> // Each item is a StateCreator<S>, so we pull out S
//   >;

//   //
//   // 2) The final store shape is the base ProjectState<PC> plus all slices
//   //
//   type StoreType = ProjectState<PC> & CombinedSlices;

//   //
//   // 3) Actually create the store with a properly typed object
//   //
//   const projectStore = createStore<StoreType>((set, get, store) => ({
//     ...createSlice<PC>(initialState)(set, get, store),
//     ...sliceCreators.reduce(
//       (acc, slice) => {
//         return {...acc, ...slice(set, get, store)};
//       },
//       {} as Record<string, unknown>,
//     ),
//   }));

//
// 4) Provide a typed selector hook
//
//   function useProjectStore<T>(selector: (state: StoreType) => T): T {
//     // Cast if needed, or if your `useBaseProjectStore` is generic, pass the type parameter directly
//     return useBaseProjectStore(selector as (state: StoreType) => T);
//   }

//   return {projectStore, useProjectStore};
// }

export function createProjectSlice<PC extends BaseProjectConfig>(
  props: InitialState<PC>,
): StateCreator<ProjectState<PC>> {
  const {
    config: configProps,
    project: projectStateProps,
    duckDbConnector,
    ...restState
  } = props;
  const initialConfig: PC = {
    ...INITIAL_BASE_PROJECT_CONFIG,
    ...configProps,
  } as PC;
  const initialProjectState: ProjectStateProps<PC> = {
    ...INITIAL_BASE_PROJECT_STATE,
    ...projectStateProps,
    schema: projectStateProps.schema ?? INITIAL_BASE_PROJECT_STATE.schema,
    lastSavedConfig: undefined,
    duckDbConnector: duckDbConnector as DuckDbConnector,
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

        if (!get().project.duckDbConnector) {
          try {
            const {WasmDuckDbConnector} = await import('@sqlrooms/duckdb');
            const connector = new WasmDuckDbConnector();
            await connector.initialize();

            set((state) =>
              produce(state, (draft) => {
                draft.project.duckDbConnector = connector;
              }),
            );
          } catch (err) {
            console.error(
              'Failed to initialize default DuckDB connector:',
              err,
            );
            get().project.captureException(err);
            throw err;
          }
        } else {
          await get().project.duckDbConnector.initialize();
        }

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
        const {tables, duckDbConnector} = get().project;
        const table = tables.find((t) => t.tableName === tableName);
        if (table) {
          return table;
        }

        if (data instanceof arrow.Table) {
          await createTableFromArrowTable(tableName, data, duckDbConnector);
        } else {
          await createTableFromObjects(tableName, data, duckDbConnector);
        }

        const newTable = await duckDbConnector.getTableSchema(tableName);

        set((state) =>
          produce(state, (draft) => {
            draft.project.tables.push(newTable);
          }),
        );
        await get().project.updateReadyDataSources();
        return newTable;
      },

      async addOrUpdateSqlQueryDataSource(tableName, query, oldTableName) {
        const {schema, duckDbConnector} = get().project;
        const newTableName =
          tableName !== oldTableName
            ? convertToUniqueColumnOrTableName(
                tableName,
                await duckDbConnector.getTables(schema),
              )
            : tableName;

        const {rowCount} = await createTableFromQuery(
          newTableName,
          query,
          duckDbConnector,
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
        await get().project.setTables(await duckDbConnector.getTableSchemas());
      },

      removeSqlQueryDataSource: async (tableName) => {
        const {duckDbConnector} = get().project;
        await duckDbConnector.dropTable(tableName);
        set((state) =>
          produce(state, (draft) => {
            draft.config.dataSources = draft.config.dataSources.filter(
              (d) => d.tableName !== tableName,
            );
            delete draft.project.dataSourceStates[tableName];
          }),
        );
        await get().project.setTables(await duckDbConnector.getTableSchemas());
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
        const {duckDbConnector} = get().project;
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
            const result = await duckDbConnector.loadFile(
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
        const {duckDbConnector} = get().project;
        const fileInfo =
          info instanceof File
            ? (
                await processDroppedFile({
                  file: info,
                  existingTables: await duckDbConnector.getTables(),
                  duckDbConnector,
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
          convertToUniqueColumnOrTableName(
            name,
            await duckDbConnector.getTables(),
          );
        if (duckdbFileName) {
          const result = await duckDbConnector.loadFile(
            duckdbFileName,
            tableName,
          );
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
        const {duckDbConnector} = get().project;
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
        duckDbConnector.dropFile(pathname);
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
        const {duckDbConnector} = get().project;
        const tables = await duckDbConnector.getTableSchemas();
        await get().project.setTables(tables);
        return tables;
      },
    };

    return {config: initialConfig, project: projectState, ...restState};

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
      const {duckDbConnector} = get().project;
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

          const resultTable = await duckDbConnector.query(
            `CREATE OR REPLACE TABLE ${tableName} AS ${sqlQuery}`,
          );

          const countResult = await duckDbConnector.query(
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
      const {duckDbConnector} = get().project;
      const tables = await duckDbConnector.getTableSchemas();
      await get().project.setTables(tables);
      return tables;
    }
  };

  return slice;
}
