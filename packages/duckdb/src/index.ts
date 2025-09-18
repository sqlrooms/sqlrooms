/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export * from './types';
export * from './useDuckDb';
export * from './exportToCsv';
export {arrowTableToJson} from './arrow-utils';
export {
  getDuckDbTypeCategory,
  getArrowColumnTypeCategory,
} from './typeCategories';
export * from './useSql';
export {
  createDuckDbSlice,
  type DuckDbSliceState,
  useStoreWithDuckDb,
} from './DuckDbSlice';
export * from './connectors/DuckDbConnector';
export * from './connectors/BaseDuckDbConnector';
export {
  createDuckDbConnector,
  createWasmDuckDbConnector,
  isWasmDuckDbConnector,
  type WasmDuckDbConnector,
} from './connectors/createDuckDbConnector';
export {createWebSocketDuckDbConnector} from './connectors/WebSocketDuckDbConnector';
export * from './connectors/load/load';
export * from './duckdb-utils';
export {
  LoadFileOptions,
  SpatialLoadFileOptions,
  isSpatialLoadFileOptions,
} from '@sqlrooms/room-config';
export {
  type TypedRowAccessor,
  createTypedRowAccessor,
} from './typedRowAccessor';
export {DuckDBAccessMode} from '@duckdb/duckdb-wasm';
export * from '@sqlrooms/duckdb-config';
export type {DuckDBBundles, DuckDBConfig} from '@duckdb/duckdb-wasm';
