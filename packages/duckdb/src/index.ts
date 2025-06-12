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
  createDefaultDuckDbConfig,
  DuckDbSliceConfig,
  type DuckDbSliceState,
  useStoreWithDuckDb,
} from './DuckDbSlice';
export * from './connectors/DuckDbConnector';
export * from './connectors/BaseDuckDbConnector';
export * from './connectors/WasmDuckDbConnector';
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
