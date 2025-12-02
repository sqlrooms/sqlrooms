/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DuckDBAccessMode} from '@duckdb/duckdb-wasm';
export type {DuckDBBundles, DuckDBConfig} from '@duckdb/duckdb-wasm';
export * from '@sqlrooms/duckdb-core';
export {
  createTypedRowAccessor,
  type TypedRowAccessor,
} from '@sqlrooms/duckdb-core';
export {
  isSpatialLoadFileOptions,
  LoadFileOptions,
  SpatialLoadFileOptions,
} from '@sqlrooms/room-config';
export {
  createDuckDbConnector,
  createWasmDuckDbConnector,
  isWasmDuckDbConnector,
  type WasmDuckDbConnector,
} from './connectors/createDuckDbConnector';
export {createWebSocketDuckDbConnector} from './connectors/WebSocketDuckDbConnector';
export {
  createDuckDbSlice,
  useStoreWithDuckDb,
  type DuckDbSliceState,
  type SchemaAndDatabase,
} from './DuckDbSlice';
export * from './exportToCsv';
export {
  getArrowColumnTypeCategory,
  getDuckDbTypeCategory,
} from './typeCategories';
export * from './types';
export * from './useDuckDb';
export * from './useSql';
