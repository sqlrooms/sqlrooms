import type {Extension} from '@codemirror/state';
import type {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {createDuckDbExtension} from './duck-db';

export const SqlDialects = {
  DuckDb: 'duck-db',
} as const;

export type SqlDialect = (typeof SqlDialects)[keyof typeof SqlDialects];

export type SqlExtensionOptions = {
  dialect: SqlDialect;
  currentSchemas: DataTable[];
  connector?: DuckDbConnector; // TODO: change to generic connector
};

/**
 * Creates SQL extensions for the specified dialect.
 * Routes to dialect-specific extension creators.
 */
export function createSqlExtension({
  dialect,
  currentSchemas,
  connector,
}: SqlExtensionOptions): Extension[] {
  switch (dialect) {
    case SqlDialects.DuckDb:
      return createDuckDbExtension({
        currentSchemas,
        connector,
      });
    default:
      throw new Error(`Unsupported SQL dialect: ${dialect}`);
  }
}
