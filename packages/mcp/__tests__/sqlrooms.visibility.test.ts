import {describe, expect, jest, test} from '@jest/globals';
import type {DataTable} from '@sqlrooms/duckdb';
import type {StoreApi} from '@sqlrooms/room-store';
import {
  createSqlRoomsRoomCapabilities,
  type SqlRoomsCapabilityState,
} from '../src/sqlrooms';
import {filterVisibleTables} from '../src/tableVisibility';

jest.mock('@sqlrooms/duckdb', () => ({
  arrowTableToJson: jest.fn(),
  getTableDisplayName: jest.fn(),
  getTableIdentity: jest.fn(),
  resolveTableReference: jest.fn(),
}));

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

  test('rejects reserved-prefix table names before querying the connector', async () => {
    const connectorQuery = jest.fn();
    const store = {
      getState: () => ({
        db: {
          sqlSelectToJson: async () => ({
            error: false,
            statements: [
              {
                node: {
                  type: 'SELECT_NODE',
                  from_table: {
                    type: 'BASE_TABLE',
                    schema_name: 'main',
                    table_name: '__SQLROOMS_state',
                  },
                },
              },
            ],
          }),
          getConnector: async () => ({query: connectorQuery}),
        },
      }),
    } as unknown as StoreApi<SqlRoomsCapabilityState>;
    const queryCapability = createSqlRoomsRoomCapabilities({store}).find(
      (capability) => capability.name === 'query',
    );

    const result = await queryCapability!.execute(
      {sql: 'select * from main.__SQLROOMS_state'},
      {surface: 'test'},
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'query_internal_namespace',
    });
    expect(connectorQuery).not.toHaveBeenCalled();
  });
});
