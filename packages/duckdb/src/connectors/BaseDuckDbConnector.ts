import {
  isSpatialLoadFileOptions,
  LoadFileOptions,
  StandardLoadOptions,
} from '@sqlrooms/project-config';
import * as arrow from 'apache-arrow';
import {DuckDbConnector} from './DuckDbConnector';
import {load, loadObjects, loadSpatial} from './load/load';
import {createTypedRowAccessor} from '../typedRowAccessor';
import {TypeMap} from 'apache-arrow';

export class BaseDuckDbConnector implements DuckDbConnector {
  protected dbPath: string;
  protected initializationQuery: string;
  protected initialized = false;
  protected initializing: Promise<void> | null = null;

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
    // To be overridden by subclasses
    if (this.initializationQuery) {
      await this.query(this.initializationQuery);
    }
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    // To be implemented by subclasses
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async execute(query: string): Promise<void> {
    await this.query(query);
  }

  async query<T extends TypeMap = any>(query: string): Promise<arrow.Table<T>> {
    // To be implemented by subclasses
    throw new Error('Not implemented', {cause: query});
  }

  async queryJson<T = Record<string, any>>(
    query: string,
  ): Promise<Iterable<T>> {
    const arrowTable = await this.query(query);
    return createTypedRowAccessor({arrowTable});
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
      await this.query(loadSpatial(tableName, fileName, opts));
    } else {
      await this.query(load(opts?.method ?? 'auto', tableName, fileName, opts));
    }
  }

  async loadArrow(
    file: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ) {
    // To be implemented by subclasses
    throw new Error('Not implemented', {cause: {file, tableName, opts}});
  }

  async loadObjects(
    file: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ) {
    await this.ensureInitialized();
    await this.query(loadObjects(tableName, file, opts));
  }
}
