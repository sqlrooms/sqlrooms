import {
  isSpatialLoadFileOptions,
  LoadFileOptions,
  StandardLoadOptions,
} from '@sqlrooms/room-config';
import * as arrow from 'apache-arrow';
import {TypeMap} from 'apache-arrow';
import {DuckDbConnector, QueryHandle, QueryOptions} from './DuckDbConnector';
import {load, loadObjects, loadSpatial} from './load/load';
import {createTypedRowAccessor} from '../typedRowAccessor';

export abstract class BaseDuckDbConnector implements DuckDbConnector {
  protected dbPath: string;
  protected initializationQuery: string;
  protected initialized = false;
  protected initializing: Promise<void> | null = null;
  protected activeQueries = new Map<string, AbortController>();

  constructor({
    initializationQuery = '',
    dbPath = ':memory:',
  }: {
    dbPath?: string;
    initializationQuery?: string;
  } = {}) {
    this.dbPath = dbPath;
    this.initializationQuery = initializationQuery;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initializing) {
      return this.initializing;
    }
    this.initializing = this.initializeInternal();
    return this.initializing;
  }

  protected async initializeInternal(): Promise<void> {
    // To be implemented by subclasses
  }

  async destroy(): Promise<void> {
    // To be implemented by subclasses
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initializing) {
      await this.initializing;
    }
  }

  /**
   * Cancel a query by its internal ID
   * @param queryId Internal query ID to cancel
   */
  protected async cancelQueryInternal(queryId: string): Promise<void> {
    const abortController = this.activeQueries.get(queryId);
    if (abortController) {
      abortController.abort();
      this.activeQueries.delete(queryId);
    }
    // Subclasses can override this for additional cleanup
  }

  /**
   * Abstract method for executing a query with abort signal support.
   * Subclasses must implement this to handle the actual query execution.
   */
  protected abstract executeQueryInternal<T extends TypeMap = any>(
    query: string,
    signal: AbortSignal,
    queryId?: string,
  ): Promise<arrow.Table<T>>;

  /**
   * Creates a QueryHandle with common signal handling logic.
   * This method handles the AbortController setup, signal chaining, and cleanup.
   */
  protected createQueryHandleInternal<T>(
    queryPromiseFactory: (signal: AbortSignal, queryId: string) => Promise<T>,
    options?: QueryOptions,
  ): QueryHandle<T> {
    const abortController = new AbortController();
    const queryId = this.generateQueryId();

    // If user provided a signal, listen for its abort event
    if (options?.signal) {
      const userSignal = options.signal;
      if (userSignal.aborted) {
        abortController.abort();
      } else {
        userSignal.addEventListener('abort', () => {
          abortController.abort();
        });
      }
    }

    this.activeQueries.set(queryId, abortController);

    // Execute the query with abort signal support
    const resultPromise = queryPromiseFactory(
      abortController.signal,
      queryId,
    ).finally(() => {
      this.activeQueries.delete(queryId);
    });

    return {
      result: resultPromise,
      signal: abortController.signal,
      cancel: async () => {
        await this.cancelQueryInternal(queryId);
      },
    };
  }

  execute(sql: string, options?: QueryOptions): QueryHandle {
    return this.createQueryHandleInternal(
      (signal, queryId) => this.executeQueryInternal(sql, signal, queryId),
      options,
    );
  }

  query<T extends TypeMap = any>(
    query: string,
    options?: QueryOptions,
  ): QueryHandle<arrow.Table<T>> {
    return this.createQueryHandleInternal(
      (signal, queryId) => this.executeQueryInternal<T>(query, signal, queryId),
      options,
    );
  }

  queryJson<T = Record<string, any>>(
    query: string,
    options?: QueryOptions,
  ): QueryHandle<Iterable<T>> {
    return this.createQueryHandleInternal(async (signal, queryId) => {
      const table = await this.executeQueryInternal(query, signal, queryId);
      return createTypedRowAccessor({arrowTable: table});
    }, options);
  }

  async loadFile(
    file: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ) {
    if (file instanceof File) {
      throw new Error('Not implemented', {cause: {file, tableName, opts}});
    }
    const fileName = file;
    if (opts && isSpatialLoadFileOptions(opts)) {
      const queryHandle = this.query(loadSpatial(tableName, fileName, opts));
      await queryHandle.result;
    } else {
      const queryHandle = this.query(
        load(opts?.method ?? 'auto', tableName, fileName, opts),
      );
      await queryHandle.result;
    }
  }

  async loadArrow(
    file: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async loadObjects(
    file: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ) {
    await this.ensureInitialized();
    const queryHandle = this.query(loadObjects(tableName, file, opts));
    await queryHandle.result;
  }

  protected generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
