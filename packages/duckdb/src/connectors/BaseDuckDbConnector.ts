import {
  isSpatialLoadFileOptions,
  LoadFileOptions,
  StandardLoadOptions,
} from '@sqlrooms/room-config';
import * as arrow from 'apache-arrow';
import {TypeMap} from 'apache-arrow';
import {DuckDbConnector, QueryHandle, QueryOptions} from './DuckDbConnector';
import {load, loadObjects as loadObjectsSql, loadSpatial} from './load/load';
import {createTypedRowAccessor} from '../typedRowAccessor';

export interface BaseDuckDbConnectorOptions {
  dbPath?: string;
  initializationQuery?: string;
}

export interface BaseDuckDbConnectorImpl {
  initializeInternal?(): Promise<void>;
  destroyInternal?(): Promise<void>;
  executeQueryInternal<T extends TypeMap = any>(
    query: string,
    signal: AbortSignal,
    queryId?: string,
  ): Promise<arrow.Table<T>>;
  cancelQueryInternal?(queryId: string): Promise<void>;
  loadArrowInternal?(
    file: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ): Promise<void>;
  loadObjectsInternal?(
    file: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ): Promise<void>;
  loadFileInternal?(
    file: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ): Promise<void>;
}

export function createBaseDuckDbConnector(
  {
    dbPath = ':memory:',
    initializationQuery = '',
  }: BaseDuckDbConnectorOptions = {},
  impl: BaseDuckDbConnectorImpl,
): DuckDbConnector {
  const state = {
    dbPath,
    initializationQuery,
    initialized: false,
    initializing: null as Promise<void> | null,
    activeQueries: new Map<string, AbortController>(),
  };

  const ensureInitialized = async () => {
    if (!state.initialized && state.initializing) {
      await state.initializing;
    }
  };

  const initialize = async () => {
    if (state.initialized) {
      return;
    }
    if (state.initializing) {
      return state.initializing;
    }
    state.initializing = (async () => {
      await impl.initializeInternal?.();
      state.initialized = true;
      state.initializing = null;
    })().catch((err) => {
      state.initialized = false;
      state.initializing = null;
      throw err;
    });
    return state.initializing;
  };

  const destroy = async () => {
    await impl.destroyInternal?.();
    state.initialized = false;
    state.initializing = null;
  };

  const generateQueryId = () =>
    `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const cancelQuery = async (queryId: string) => {
    const abortController = state.activeQueries.get(queryId);
    if (abortController) {
      abortController.abort();
      state.activeQueries.delete(queryId);
    }
    await impl.cancelQueryInternal?.(queryId);
  };

  const createQueryHandle = <T>(
    queryPromiseFactory: (signal: AbortSignal, queryId: string) => Promise<T>,
    options?: QueryOptions,
  ): QueryHandle<T> => {
    const abortController = new AbortController();
    const queryId = generateQueryId();
    if (options?.signal) {
      const userSignal = options.signal;
      if (userSignal.aborted) abortController.abort();
      else userSignal.addEventListener('abort', () => abortController.abort());
    }
    state.activeQueries.set(queryId, abortController);
    const resultPromise = queryPromiseFactory(
      abortController.signal,
      queryId,
    ).finally(() => {
      state.activeQueries.delete(queryId);
    });
    return {
      result: resultPromise,
      signal: abortController.signal,
      cancel: async () => cancelQuery(queryId),
    };
  };

  const execute = (sql: string, options?: QueryOptions): QueryHandle =>
    createQueryHandle(
      (signal, id) => impl.executeQueryInternal(sql, signal, id),
      options,
    );

  const query = <T extends TypeMap = any>(
    queryStr: string,
    options?: QueryOptions,
  ): QueryHandle<arrow.Table<T>> =>
    createQueryHandle(
      (signal, id) => impl.executeQueryInternal<T>(queryStr, signal, id),
      options,
    );

  const queryJson = <T = Record<string, any>>(
    queryStr: string,
    options?: QueryOptions,
  ): QueryHandle<Iterable<T>> =>
    createQueryHandle(async (signal, id) => {
      const table = await impl.executeQueryInternal(queryStr, signal, id);
      return createTypedRowAccessor({arrowTable: table});
    }, options);

  const loadFile = async (
    file: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ) => {
    if (impl.loadFileInternal) {
      return impl.loadFileInternal(file, tableName, opts);
    }
    if (file instanceof File) {
      throw new Error('Not implemented', {cause: {file, tableName, opts}});
    }
    const fileName = file;
    await ensureInitialized();
    if (opts && isSpatialLoadFileOptions(opts)) {
      await query(loadSpatial(tableName, fileName, opts)).result;
    } else {
      await query(load(opts?.method ?? 'auto', tableName, fileName, opts))
        .result;
    }
  };

  const loadArrow = async (
    file: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ): Promise<void> => {
    if (impl.loadArrowInternal) {
      return impl.loadArrowInternal(file, tableName, opts);
    }
    throw new Error('Not implemented');
  };

  const loadObjects = async (
    file: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ) => {
    if (impl.loadObjectsInternal) {
      return impl.loadObjectsInternal(file, tableName, opts);
    }
    await ensureInitialized();
    await query(loadObjectsSql(tableName, file, opts)).result;
  };

  return {
    initialize,
    destroy,
    execute,
    query,
    queryJson,
    loadFile,
    loadArrow,
    loadObjects,
  };
}
