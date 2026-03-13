import {DbSliceState, createDbSlice} from '@sqlrooms/db';
import {DataTable, DuckDbConnector, LoadFileOptions} from '@sqlrooms/duckdb';
import {
  CreateLayoutSliceProps,
  LayoutSliceState,
  createLayoutSlice,
} from '@sqlrooms/layout';
import {
  BaseRoomConfig,
  DataSource,
  DataSourceTypes,
  FileDataSource,
  LayoutConfig,
  SqlQueryDataSource,
  UrlDataSource,
  createDefaultBaseRoomConfig,
  isFileDataSource,
  isSqlQueryDataSource,
  isUrlDataSource,
} from '@sqlrooms/room-config';
import {
  BaseRoomStoreState,
  CommandSliceState,
  CreateBaseRoomSliceProps,
  CreateCommandSliceProps,
  RoomCommand,
  createBaseRoomSlice,
  createCommandSlice,
  isRoomSliceWithInitialize,
  registerCommandsForOwner,
  unregisterCommandsForOwner,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {ErrorBoundary} from '@sqlrooms/ui';
import {
  ProgressInfo,
  convertToUniqueColumnOrTableName,
  convertToValidColumnOrTableName,
  downloadFile,
} from '@sqlrooms/utils';
import {produce} from 'immer';
import {ReactNode} from 'react';
import {z} from 'zod';
import {StateCreator, StoreApi} from 'zustand';
import {
  DataSourceState,
  DataSourceStatus,
  RoomFileInfo,
  RoomFileState,
} from './types';

export type RoomShellSliceConfig = BaseRoomConfig;

export type RoomShellStore = StoreApi<RoomShellSliceState>;

export type TaskProgress = {
  progress?: number | undefined;
  message: string;
};

export type RoomShellSliceState = {
  initialize?: () => Promise<void>;
  room: BaseRoomStoreState['room'] & {
    config: RoomShellSliceConfig;
    tasksProgress: Record<string, TaskProgress>;

    setConfig: (config: RoomShellSliceConfig) => void;
    setTaskProgress: (
      id: string,
      taskProgress: TaskProgress | undefined,
    ) => void;
    getLoadingProgress: () => TaskProgress | undefined;

    roomFiles: RoomFileInfo[];
    roomFilesProgress: {[pathname: string]: RoomFileState};
    isDataAvailable: boolean; // Whether the data has been loaded (on initialization)
    dataSourceStates: {[tableName: string]: DataSourceState}; // TODO
    /**
     * Load a file data source. A fileDataSourceLoader implementation can be passed to
     * createRoomShellSlice to specify how file data sources should be loaded.
     *
     * @example
     * ```ts
     *     ...createRoomShellSlice({
     *       config: {
     *         dataSources: [
     *           { type: 'file', fileName: 'earthquakes.parquet', tableName: 'earthquakes' },
     *         ],
     *       },
     *       room: {
     *         fileDataSourceLoader: async ({fileName}, onProgress) =>
     *           await downloadFile(`https://some.url/${fileName}`, {onProgress}),
     *       },
     *     })(set, get, store)
     * ```
     *
     * @param fileName - The name of the file to load.
     * @param onProgress - A callback to report the progress of the download.
     * @returns The loaded file.
     */
    fileDataSourceLoader?: (
      {fileName}: FileDataSource,
      onProgress: (progress: ProgressInfo) => void,
    ) => Promise<Uint8Array | File>;
    CustomErrorBoundary: React.ComponentType<{
      onRetry?: () => void;
      children?: ReactNode;
    }>;

    setRoomTitle(title: string): void;
    setDescription(description: string): void;

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
      abortSignal?: AbortSignal,
    ): Promise<void>;
    areDatasetsReady(): boolean;

    addRoomFile(
      file: File | string,
      tableName?: string,
      loadFileOptions?: LoadFileOptions,
    ): Promise<DataTable | undefined>;
    /**
     * @deprecated Use removeDataSource or removeRoomFile instead
     */
    removeSqlQueryDataSource(tableName: string): Promise<void>;
    /**
     * Removes a data source from the room by tableName.
     * @param tableName - The name of the table of the data source to remove.
     */
    removeDataSource(tableName: string): Promise<void>;
    /**
     * Removes a file data source from the room by pathname.
     * @param pathname - The pathname of the file to remove.
     */
    removeRoomFile(pathname: string): Promise<void>;
    setRoomFiles(info: RoomFileInfo[]): void;
    setRoomFileProgress(pathname: string, fileState: RoomFileState): void;
    addDataSource: (
      dataSource: DataSource,
      status?: DataSourceStatus,
    ) => Promise<void>;
  };
} & DbSliceState &
  LayoutSliceState &
  CommandSliceState;

/**
 * 	This type takes a union type U (for example, A | B) and transforms it into an intersection type (A & B). This is useful because if you pass in, say, two slices of type { a: number } and { b: string }, the union of the slice types would be { a: number } | { b: string }, but you really want an object that has both properties—i.e. { a: number } & { b: string }.
 */
type CreateRoomShellSliceProps = CreateBaseRoomSliceProps & {
  connector?: DuckDbConnector;
  config?: Partial<
    RoomShellSliceConfig & {
      /** @deprecated Use layout.config instead */
      layout?: LayoutConfig;
    }
  >;
  layout?: CreateLayoutSliceProps;
  fileDataSourceLoader?: RoomShellSliceState['room']['fileDataSourceLoader'];
  CustomErrorBoundary?: RoomShellSliceState['room']['CustomErrorBoundary'];
  createCommandProps?: CreateCommandSliceProps;
  /** @deprecated Use direct props instead e.g. layout.panels */
  room?: Partial<Pick<LayoutSliceState['layout'], 'panels'>>;
};

const DOWNLOAD_DATA_SOURCES_TASK = 'download-data-sources';
const INIT_DB_TASK = 'init-db';
const INIT_ROOM_TASK = 'init-room';
const ROOM_SHELL_COMMAND_OWNER = '@sqlrooms/room-shell';

const RoomSetTitleCommandInput = z.object({
  title: z.string().min(1).describe('Room title.'),
});
type RoomSetTitleCommandInput = z.infer<typeof RoomSetTitleCommandInput>;

const RoomSetDescriptionCommandInput = z.object({
  description: z.string().describe('Room description.'),
});
type RoomSetDescriptionCommandInput = z.infer<
  typeof RoomSetDescriptionCommandInput
>;

const RoomRemoveDataSourceInput = z.object({
  tableName: z.string().describe('Table name of the data source to remove.'),
});
type RoomRemoveDataSourceInput = z.infer<typeof RoomRemoveDataSourceInput>;

const RoomAddUrlDataSourceInput = z.object({
  url: z.string().url().describe('URL of the source file to load.'),
  tableName: z
    .string()
    .describe('Target table name where the URL data should be loaded.'),
  httpMethod: z
    .string()
    .optional()
    .describe('Optional HTTP method for URL fetch.'),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional HTTP headers for URL fetch.'),
});
type RoomAddUrlDataSourceInput = z.infer<typeof RoomAddUrlDataSourceInput>;

const RoomAddSqlDataSourceInput = z.object({
  query: z.string().describe('SQL query that defines the derived table.'),
  tableName: z.string().describe('Target table name for query result.'),
});
type RoomAddSqlDataSourceInput = z.infer<typeof RoomAddSqlDataSourceInput>;

export function createRoomShellSlice(
  props: CreateRoomShellSliceProps,
): StateCreator<RoomShellSliceState> {
  const slice: StateCreator<RoomShellSliceState> = (set, get, store) => {
    const {
      connector,
      config: configProps,
      layout: layoutProps,
      room: deprecatedRoomProps,
      fileDataSourceLoader,
      CustomErrorBoundary = ErrorBoundary,
      createCommandProps,
      captureException = (exception) => console.error(exception),
      ...restProps
    } = props;

    const createLayoutProps: CreateLayoutSliceProps = {
      ...layoutProps,
      config: layoutProps?.config ?? configProps?.layout,
      panels: layoutProps?.panels ?? deprecatedRoomProps?.panels,
    };
    const roomSliceState = createBaseRoomSlice({
      captureException,
    })(set, get, store);

    const sliceState: RoomShellSliceState = {
      ...roomSliceState,
      ...createDbSlice({duckDb: {connector}})(set, get, store),
      ...createLayoutSlice(createLayoutProps)(set, get, store),
      ...createCommandSlice(createCommandProps)(set, get, store),
      room: {
        ...roomSliceState.room,
        config: {
          ...createDefaultBaseRoomConfig(),
          ...configProps,
        },
        CustomErrorBoundary,
        roomFiles: [],
        roomFilesProgress: {},
        isDataAvailable: false,
        dataSourceStates: {},
        tasksProgress: {},
        fileDataSourceLoader,

        setConfig: (config) => {
          set((state) =>
            produce(state, (draft) => {
              draft.room.config = config;
            }),
          );
        },

        async initialize() {
          registerCommandsForOwner(
            store,
            ROOM_SHELL_COMMAND_OWNER,
            createRoomShellCommands(),
          );
          const {setTaskProgress} = get().room;
          try {
            setTaskProgress(INIT_DB_TASK, {
              message: 'Establishing database connection…',
              progress: undefined,
            });
            await get().db.initialize();
            setTaskProgress(INIT_DB_TASK, undefined);

            setTaskProgress(INIT_ROOM_TASK, {
              message: 'Loading data sources…',
              progress: undefined,
            });

            await updateReadyDataSources();
            await maybeDownloadDataSources();

            setTaskProgress(INIT_ROOM_TASK, {
              message: 'Initializing room…',
              progress: undefined,
            });
            // Call initialize on all other slices that have an initialize function
            const slices = Object.entries(store.getState()).filter(
              ([key, value]) =>
                key !== 'room' &&
                key !== 'db' &&
                isRoomSliceWithInitialize(value),
            );
            for (const [sliceName, slice] of slices) {
              if (isRoomSliceWithInitialize(slice)) {
                setTaskProgress(INIT_ROOM_TASK, {
                  message: `Initializing ${sliceName}…`,
                  progress: undefined,
                });

                await slice.initialize();
              }
            }
            const state = store.getState();
            if (isRoomSliceWithInitialize(state)) {
              await state.initialize();
            }
          } catch (error) {
            captureException(error);
            throw error;
          } finally {
            setTaskProgress(INIT_ROOM_TASK, undefined);
          }
        },

        async destroy() {
          unregisterCommandsForOwner(store, ROOM_SHELL_COMMAND_OWNER);
          await roomSliceState.room.destroy();
        },

        /** Returns the progress of the last task */
        getLoadingProgress() {
          const {tasksProgress} = get().room;
          const keys = Object.keys(tasksProgress);
          const lastKey = keys[keys.length - 1];
          if (lastKey) {
            return tasksProgress[lastKey];
          }
          return undefined;
        },

        setTaskProgress(id, taskProgress) {
          set((state) =>
            produce(state, (draft) => {
              if (taskProgress) {
                draft.room.tasksProgress[id] = taskProgress;
              } else {
                delete draft.room.tasksProgress[id];
              }
            }),
          );
        },

        setRoomTitle: (title) =>
          set((state) =>
            produce(state, (draft) => {
              draft.room.config.title = title;
            }),
          ),

        setDescription: (description) =>
          set((state) =>
            produce(state, (draft) => {
              draft.room.config.description = description;
            }),
          ),

        addDataSource: async (
          dataSource,
          status = DataSourceStatus.PENDING,
        ) => {
          set((state) =>
            produce(state, (draft) => {
              const dataSources = draft.room.config.dataSources;
              const tableName = dataSource.tableName;
              const index = dataSources.findIndex(
                (d) => d.tableName === tableName,
              );
              if (index >= 0) {
                dataSources[index] = dataSource;
              } else {
                dataSources.push(dataSource);
              }
              draft.room.dataSourceStates[tableName] = {status};
            }),
          );
          await maybeDownloadDataSources();
        },

        async addOrUpdateSqlQueryDataSource(
          tableName,
          query,
          oldTableName,
          abortSignal,
        ) {
          const {schema} = get().db;
          const {db} = get();
          const dbConnectors = get().db.connectors;
          const newTableName =
            tableName !== oldTableName
              ? convertToUniqueColumnOrTableName(
                  tableName,
                  await db.getTables(schema),
                )
              : tableName;
          let rowCount: number | undefined;
          if (dbConnectors?.runQuery) {
            const routed = await dbConnectors.runQuery({
              sql: query,
              queryType: 'arrow',
              materialize: true,
              materializedName: newTableName,
              signal: abortSignal,
            });
            const relation = routed.relationName || newTableName;
            rowCount = await db.getTableRowCount(relation as string, schema);
          } else {
            const created = await db.createTableFromQuery(newTableName, query, {
              abortSignal,
            });
            rowCount = created.rowCount;
          }
          if (rowCount !== undefined) {
            get().db.setTableRowCount(newTableName, rowCount);
          }
          set((state) =>
            produce(state, (draft) => {
              const newDataSource = {
                type: DataSourceTypes.enum.sql,
                sqlQuery: query,
                tableName: newTableName,
              };
              if (oldTableName) {
                draft.room.config.dataSources =
                  draft.room.config.dataSources.map((dataSource) =>
                    dataSource.tableName === oldTableName
                      ? newDataSource
                      : dataSource,
                  );
                delete draft.room.dataSourceStates[oldTableName];
              } else {
                draft.room.config.dataSources.push(newDataSource);
              }
              draft.room.dataSourceStates[newTableName] = {
                status: DataSourceStatus.READY,
              };
            }),
          );
          get().db.refreshTableSchemas();
        },

        setRoomFiles: (roomFiles) =>
          set((state) =>
            produce(state, (draft) => {
              draft.room.roomFiles = roomFiles;
            }),
          ),

        async addRoomFile(file, desiredTableName, loadOptions) {
          const {db} = get();

          const pathname = file instanceof File ? file.name : file;
          const tableName =
            desiredTableName ?? convertToValidColumnOrTableName(pathname);

          await db.connector.loadFile(file, tableName, loadOptions);

          // This must come before addDataSource, as addDataSource can trigger
          // download which also adds the file
          set((state) =>
            produce(state, (draft) => {
              draft.room.roomFiles.push({
                pathname,
                duckdbFileName: pathname,
                size: file instanceof File ? file.size : undefined,
                file: file instanceof File ? file : undefined,
              });
            }),
          );
          await get().room.addDataSource(
            {
              type: DataSourceTypes.enum.file,
              fileName: pathname,
              tableName,
            },
            // duckdbFileName ? DataSourceStatus.READY : DataSourceStatus.PENDING,
            DataSourceStatus.READY,
          );
          await get().db.refreshTableSchemas();
          set((state) =>
            produce(state, (draft) => {
              if (
                Object.values(get().room.dataSourceStates).every(
                  (ds) => ds.status === DataSourceStatus.READY,
                )
              ) {
                draft.room.isDataAvailable = true;
              }
            }),
          );
          return get().db.findTableByName(tableName);
        },
        removeSqlQueryDataSource: async (tableName) => {
          await get().room.removeDataSource(tableName);
        },
        removeDataSource: async (tableName) => {
          const {db} = get();
          const dataSource = get().room.config.dataSources.find(
            (d) => d.tableName === tableName,
          );
          if (dataSource) {
            set((state) =>
              produce(state, (draft) => {
                draft.room.config.dataSources =
                  draft.room.config.dataSources.filter(
                    (d) => d.tableName !== tableName,
                  );
                if (dataSource && isFileDataSource(dataSource)) {
                  draft.room.roomFiles = draft.room.roomFiles.filter(
                    (f) => f.pathname !== dataSource.fileName,
                  );
                }
                delete draft.room.dataSourceStates[tableName];
              }),
            );
            await db.dropRelation(tableName);
            await db.refreshTableSchemas();
          }
        },

        removeRoomFile: async (pathname) => {
          const dataSource = get().room.config.dataSources.find(
            (d) => isFileDataSource(d) && d.fileName === pathname,
          );
          if (dataSource) {
            await get().room.removeDataSource(dataSource.tableName);
          }
        },

        setRoomFileProgress(pathname, fileState) {
          set((state) =>
            produce(state, (draft) => {
              draft.room.roomFilesProgress[pathname] = fileState;
              // Update the file size in the room config from the progress info
              const fileInfo = draft.room.roomFiles.find(
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

        areDatasetsReady: () => {
          const dataSourceStates = get().room.dataSourceStates;
          const dataSources = get().room.config.dataSources;
          return dataSources.every(
            (ds) =>
              dataSourceStates[ds.tableName]?.status === DataSourceStatus.READY,
          );
        },
      },

      ...restProps,
    };

    // If the tables have changed, update the data sources
    store.subscribe((state, prevState) => {
      if (state.db.tables !== prevState.db.tables) {
        updateReadyDataSources();
      }
    });

    return sliceState;

    async function updateReadyDataSources() {
      const {tables} = get().db;
      const {dataSourceStates} = get().room;
      const {config} = get().room;
      if (!config) {
        return;
      }
      const {dataSources} = config;
      set((state) =>
        produce(state, (draft) => {
          for (const ds of dataSources) {
            const tableName = ds.tableName;
            const table = tables.find((t) => t.tableName === tableName);
            if (table) {
              draft.room.dataSourceStates[tableName] = {
                status: DataSourceStatus.READY,
              };
            } else {
              // Prev status could be ERROR or PENDING, don't change it then
              if (!dataSourceStates[tableName]?.status) {
                draft.room.dataSourceStates[tableName] = {
                  status: DataSourceStatus.PENDING,
                };
              }
            }
          }
        }),
      );
    }

    async function maybeDownloadDataSources() {
      const {roomFilesProgress, dataSourceStates} = get().room;
      const {dataSources} = get().room.config;
      const pendingDataSources = dataSources.filter(
        (ds) =>
          !dataSourceStates[ds.tableName] ||
          dataSourceStates[ds.tableName]?.status === DataSourceStatus.PENDING,
      );

      const filesToDownload = pendingDataSources.filter((ds) => {
        if (isFileDataSource(ds)) {
          return !roomFilesProgress[ds.fileName];
        }
        if (isUrlDataSource(ds)) {
          return !roomFilesProgress[ds.url];
        }
        return false;
      }) as (FileDataSource | UrlDataSource)[];

      if (filesToDownload.length > 0) {
        await downloadRoomFiles(filesToDownload);
      }

      const queriesToRun = pendingDataSources.filter(isSqlQueryDataSource);

      if (queriesToRun.length > 0) {
        await runDataSourceQueries(queriesToRun);
      }

      if (get().room.config.dataSources.length > 0) {
        set((state) =>
          produce(state, (draft) => {
            draft.room.isDataAvailable = true;
          }),
        );
      }
    }

    async function downloadRoomFiles(
      filesToDownload: (FileDataSource | UrlDataSource)[],
    ) {
      if (!filesToDownload.length) return;
      const {setTableRowCount} = get().db;
      const {captureException, setTaskProgress, setRoomFileProgress} =
        get().room;
      filesToDownload.forEach((ds) => {
        const fileName = isFileDataSource(ds) ? ds.fileName : ds.url;
        set((state) =>
          produce(state, (draft) => {
            const info = {
              duckdbFileName: fileName,
              pathname: fileName,
              file: undefined,
              size: undefined,
            };
            const index = draft.room.roomFiles.findIndex(
              (f) => f.pathname === fileName,
            );
            if (index >= 0) {
              draft.room.roomFiles[index] = info;
            } else {
              draft.room.roomFiles.push(info);
            }
          }),
        );
        setRoomFileProgress(fileName, {status: 'download'});
      });
      if (filesToDownload.length > 0) {
        updateTotalFileDownloadProgress();
      }

      const loadedFiles = await Promise.all(
        filesToDownload.map(async (ds) => {
          const fileName = isFileDataSource(ds) ? ds.fileName : ds.url;
          const onProgress = (progress: ProgressInfo) => {
            setRoomFileProgress(fileName, {
              status: 'download',
              progress,
            });
            updateTotalFileDownloadProgress();
          };
          try {
            let downloadedFile: Uint8Array | File;
            if (isFileDataSource(ds)) {
              const {fileDataSourceLoader} = get().room;
              if (!fileDataSourceLoader) {
                throw new Error('fileDataSourceLoader is not defined');
              }
              downloadedFile = await fileDataSourceLoader(ds, onProgress);
            } else if (isUrlDataSource(ds)) {
              const url = ds.url;
              downloadedFile = await downloadFile(url, {
                method: ds.httpMethod,
                headers: ds.headers,
                onProgress,
              });
            } else {
              // This should never happen as filesToDownload only contains FileDataSource | UrlDataSource
              throw new Error('Unsupported data source type');
            }
            setRoomFileProgress(fileName, {status: 'done'});
            updateTotalFileDownloadProgress();
            const {db} = get();
            await db.connector.loadFile(
              downloadedFile instanceof File
                ? downloadedFile
                : new File([new Uint8Array(downloadedFile)], fileName),
              ds.tableName,
              ds.loadOptions,
            );
            setTableRowCount(
              ds.tableName,
              await db.getTableRowCount(ds.tableName),
            );
          } catch (err) {
            captureException(err);
            console.error(err);
            setRoomFileProgress(fileName, {
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
        get().db.refreshTableSchemas();
      }
    }

    async function runDataSourceQueries(queries: SqlQueryDataSource[]) {
      const dbConnectors = (get() as any).db.connectors as
        | {
            runQuery?: (args: {
              sql: string;
              queryType?: 'arrow' | 'json' | 'exec';
              materialize?: boolean;
              materializedName?: string;
            }) => Promise<{relationName?: string}>;
          }
        | undefined;
      for (const ds of queries) {
        try {
          const {tableName, sqlQuery} = ds;
          set((state) =>
            produce(state, (draft) => {
              draft.room.dataSourceStates[tableName] = {
                status: DataSourceStatus.FETCHING,
              };
            }),
          );
          let rowCount: number | undefined;
          if (dbConnectors?.runQuery) {
            const routed = await dbConnectors.runQuery({
              sql: sqlQuery,
              queryType: 'arrow',
              materialize: true,
              materializedName: tableName,
            });
            const relation = routed.relationName || tableName;
            rowCount = await get().db.getTableRowCount(relation as string);
          } else {
            const created = await get().db.createTableFromQuery(
              tableName,
              sqlQuery,
            );
            rowCount = created.rowCount;
          }
          if (rowCount !== undefined) {
            get().db.setTableRowCount(tableName, rowCount);
          }
          set((state) =>
            produce(state, (draft) => {
              draft.room.dataSourceStates[tableName] = {
                status: DataSourceStatus.READY,
              };
            }),
          );
        } catch (err) {
          set((state) =>
            produce(state, (draft) => {
              draft.room.dataSourceStates[ds.tableName] = {
                status: DataSourceStatus.ERROR,
                message: `${err}`,
              };
            }),
          );
          // TODO: Make sure the errors are shown
        }
      }
      get()
        .db.refreshTableSchemas()
        .then(() => {
          updateReadyDataSources();
        });
    }

    function updateTotalFileDownloadProgress() {
      const {setTaskProgress, roomFilesProgress} = get().room;
      let total = 0,
        loaded = 0;
      for (const p of Object.values(roomFilesProgress)) {
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
  };

  return slice;
}

type RoomShellCommandStoreState = RoomShellSliceState;

function createRoomShellCommands(): RoomCommand<RoomShellCommandStoreState>[] {
  return [
    {
      id: 'room.set-title',
      name: 'Set room title',
      description: 'Update the room title',
      group: 'Room',
      keywords: ['room', 'title', 'name'],
      inputSchema: RoomSetTitleCommandInput,
      inputDescription: 'Provide a non-empty room title.',
      ui: {
        keystrokes: 'Mod+Alt+Shift+T',
      },
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {title} = input as RoomSetTitleCommandInput;
        getState().room.setRoomTitle(title);
        return {
          success: true,
          commandId: 'room.set-title',
          message: `Updated room title to "${title}".`,
        };
      },
    },
    {
      id: 'room.set-description',
      name: 'Set room description',
      description: 'Update the room description',
      group: 'Room',
      keywords: ['room', 'description'],
      inputSchema: RoomSetDescriptionCommandInput,
      inputDescription: 'Provide room description text.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {description} = input as RoomSetDescriptionCommandInput;
        getState().room.setDescription(description);
        return {
          success: true,
          commandId: 'room.set-description',
          message: 'Updated room description.',
        };
      },
    },
    {
      id: 'room.remove-data-source',
      name: 'Remove data source',
      description: 'Remove a data source by table name',
      group: 'Room',
      keywords: ['room', 'data source', 'remove', 'table'],
      inputSchema: RoomRemoveDataSourceInput,
      inputDescription: 'Provide tableName of the data source to remove.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'high',
        requiresConfirmation: true,
      },
      validateInput: (input, {getState}) => {
        const {tableName} = input as RoomRemoveDataSourceInput;
        const dataSource = getState().room.config.dataSources.find(
          (source) => source.tableName === tableName,
        );
        if (!dataSource) {
          throw new Error(
            `Data source for table "${tableName}" was not found.`,
          );
        }
      },
      execute: async ({getState}, input) => {
        const {tableName} = input as RoomRemoveDataSourceInput;
        await getState().room.removeDataSource(tableName);
        return {
          success: true,
          commandId: 'room.remove-data-source',
          message: `Removed data source "${tableName}".`,
        };
      },
    },
    {
      id: 'room.add-url-data-source',
      name: 'Add URL data source',
      description: 'Add a URL data source and start loading it',
      group: 'Room',
      keywords: ['room', 'data source', 'url', 'add'],
      inputSchema: RoomAddUrlDataSourceInput,
      inputDescription:
        'Provide url and tableName, with optional httpMethod and headers.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      execute: async ({getState}, input) => {
        const {url, tableName, httpMethod, headers} =
          input as RoomAddUrlDataSourceInput;
        await getState().room.addDataSource({
          type: DataSourceTypes.enum.url,
          url,
          tableName,
          ...(httpMethod ? {httpMethod} : {}),
          ...(headers ? {headers} : {}),
        });
        return {
          success: true,
          commandId: 'room.add-url-data-source',
          message: `Added URL data source "${tableName}".`,
        };
      },
    },
    {
      id: 'room.add-sql-data-source',
      name: 'Add SQL data source',
      description: 'Create a data source from a SQL query',
      group: 'Room',
      keywords: ['room', 'data source', 'sql', 'query', 'add'],
      inputSchema: RoomAddSqlDataSourceInput,
      inputDescription: 'Provide query and tableName.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      validateInput: (input) => {
        const {query} = input as RoomAddSqlDataSourceInput;
        if (!query.trim()) {
          throw new Error('Query cannot be empty.');
        }
      },
      execute: async ({getState}, input) => {
        const {query, tableName} = input as RoomAddSqlDataSourceInput;
        await getState().room.addOrUpdateSqlQueryDataSource(tableName, query);
        return {
          success: true,
          commandId: 'room.add-sql-data-source',
          message: `Added SQL data source "${tableName}".`,
        };
      },
    },
  ];
}

export function useBaseRoomShellStore<RS extends RoomShellSliceState, T>(
  selector: (state: RS) => T,
): T {
  return useBaseRoomStore<RS, T>(selector as (state: RS) => T);
}
