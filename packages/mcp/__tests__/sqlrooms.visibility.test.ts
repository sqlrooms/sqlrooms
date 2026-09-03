import {describe, expect, test} from '@jest/globals';
import type {DataTable} from '@sqlrooms/duckdb';
import {filterVisibleTables} from '../src/tableVisibility';

describe('SQLRooms capability table visibility', () => {
  test('filters internal identifiers case-insensitively', () => {
    const table = (database: string, schema: string, name: string) =>
      ({table: {database, schema, table: name}}) as DataTable;

    expect(
      filterVisibleTables(
        [
          table('memory', 'main', 'orders'),
          table('memory', 'main', '__SQLROOMS_state'),
          table('memory', '__SqlRooms', 'state'),
          table('__SQLROOMS', 'main', 'state'),
        ],
        '__SqLrOoMs',
      ).map((entry) => entry.table.table),
    ).toEqual(['orders']);
  });
});
