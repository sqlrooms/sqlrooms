import {beforeEach, describe, expect, jest, test} from '@jest/globals';

const query = jest.fn(
  async (_sql: string, _options?: {signal?: AbortSignal}) => {
    void _sql;
    void _options;
    return {rows: [{value: 1}, {value: 2}]};
  },
);
const sqlSelectToJson = jest.fn(async () => ({
  error: false,
  statements: [{node: {type: 'SELECT_NODE'}}],
}));
const invokeCommandWithPolicy = jest.fn(async (...args: unknown[]) => {
  void args;
  return {
    success: true,
    commandId: 'workspace.refresh',
  };
});

const state = {
  db: {
    tables: [
      {
        table: {database: 'main', schema: 'main', table: 'events'},
        isView: false,
        columns: [{name: 'value', type: 'INTEGER'}],
        rowCount: 2,
      },
      {
        table: {database: 'main', schema: '__sqlrooms_meta', table: 'secret'},
        isView: false,
        columns: [{name: 'payload', type: 'JSON'}],
        rowCount: 1,
      },
    ],
    sqlSelectToJson,
    getConnector: jest.fn(async () => ({query})),
  },
  commands: {
    listCommands: jest.fn(() => []),
  },
};

jest.unstable_mockModule('../store', () => ({
  roomStore: {getState: () => state},
}));
jest.unstable_mockModule('@sqlrooms/duckdb', () => ({
  arrowTableToJson: (result: {rows: unknown[]}) => [...result.rows],
  getTableDisplayName: (table: {table: string}) => table.table,
  getTableIdentity: (table: {
    database?: string;
    schema?: string;
    table: string;
  }) => [table.database, table.schema, table.table].filter(Boolean).join('.'),
  resolveTableReference: (tables: typeof state.db.tables, tableId: string) => ({
    table: tables.find(
      (table) =>
        [table.table.database, table.table.schema, table.table.table]
          .filter(Boolean)
          .join('.') === tableId,
    ),
  }),
}));
jest.unstable_mockModule('@sqlrooms/room-shell', () => ({
  invokeCommandWithPolicy,
}));

const {createCliRoomCapabilities} =
  await import('../createCliRoomCapabilities');

function capability(name: string) {
  return createCliRoomCapabilities().find((entry) => entry.name === name)!;
}

beforeEach(() => {
  query.mockClear();
  sqlSelectToJson.mockClear();
  invokeCommandWithPolicy.mockClear();
});

describe('CLI room capability handlers', () => {
  test('lists public tables without exposing internal schemas', async () => {
    const result = await capability('list_tables').execute(
      {},
      {surface: 'mcp-http'},
    );

    expect(result).toMatchObject({
      ok: true,
      data: {tables: [{tableId: 'main.main.events'}], totalCount: 1},
    });
  });

  test('bounds a parsed SELECT and forwards cancellation', async () => {
    const controller = new AbortController();
    const result = await capability('query').execute(
      {sql: 'SELECT value FROM events;', maxRows: 1},
      {surface: 'mcp-http', signal: controller.signal},
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 2'), {
      signal: controller.signal,
    });
    expect(result).toMatchObject({
      ok: true,
      data: {rows: [{value: 1}], rowCount: 1, truncated: true},
    });
  });

  test('executes external commands with confirmation denied by default', async () => {
    const controller = new AbortController();
    await capability('execute_command').execute(
      {commandId: 'workspace.refresh'},
      {surface: 'mcp-http', signal: controller.signal},
    );

    expect(invokeCommandWithPolicy).toHaveBeenCalledWith(
      expect.anything(),
      'workspace.refresh',
      undefined,
      expect.objectContaining({surface: 'mcp', signal: controller.signal}),
      {confirmed: false},
    );
  });
});
