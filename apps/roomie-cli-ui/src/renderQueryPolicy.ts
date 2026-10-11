import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import {inspectLocalSelect, needsLocalReadApproval} from '@sqlrooms/mcp/room';

/** Rendered code may query ordinary local data; external data needs an approved import. */
export async function assertLocalRenderQuery(
  db: DuckDbSliceState['db'],
  sql: string,
) {
  const statements = await inspectLocalSelect(db, sql, '__roomie');
  if (await needsLocalReadApproval(db, statements)) {
    throw new Error(
      'Rendered queries must use ordinary local data. Import or materialize external data through the approved database commands first.',
    );
  }
}
