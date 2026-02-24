export {
  getSqlErrorWithPointer,
  joinStatements,
  makeLimitQuery,
  separateLastStatement,
} from '@sqlrooms/duckdb-core';

export type DuckDbSliceState = {
  db: Record<string, unknown>;
};
