/**
 * @sqlrooms/duckdb-node - Node.js DuckDB connector for SQLRooms
 *
 * This package provides a DuckDB connector for Node.js environments using
 * the @duckdb/node-api package.
 *
 * @packageDocumentation
 */

export {
  createNodeDuckDbConnector,
  type NodeDuckDbConnector,
  type NodeDuckDbConnectorOptions,
} from './NodeDuckDbConnector';

// Re-export common types from duckdb-core for convenience
export type {
  DuckDbConnector,
  QueryHandle,
  QueryOptions,
} from '@sqlrooms/duckdb-core';
