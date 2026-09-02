import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import type {RoomCommandDescriptor} from '@sqlrooms/room-shell';

const query = jest.fn(
  async (_sql: string, _options?: {signal?: AbortSignal}) => {
    void _sql;
    void _options;
    return {rows: [{value: 1}, {value: 2}]};
  },
);
type ParsedSqlResult = {
  error: false;
  statements: Array<{node: Record<string, unknown>}>;
};
const sqlSelectToJson = jest.fn(
  async (): Promise<ParsedSqlResult> => ({
    error: false,
    statements: [{node: {type: 'SELECT_NODE'}}],
  }),
);
const invokeCommandWithPolicy = jest.fn(async (...args: unknown[]) => {
  void args;
  return {
    success: true,
    commandId: 'workspace.refresh',
  };
});
const commandDescriptor = (id: string): RoomCommandDescriptor => ({
  id,
  owner: 'test',
  name: id,
  enabled: true,
  visible: true,
  requiresInput: false,
  keystrokes: [],
  readOnly: false,
  idempotent: true,
  riskLevel: 'low',
  requiresConfirmation: false,
});
const listCommands = jest.fn((): RoomCommandDescriptor[] => [
  commandDescriptor('workspace.refresh'),
  commandDescriptor('workspace.stuck'),
]);

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
      {
        table: {database: 'main', schema: 'custom_meta', table: 'ui_state'},
        isView: false,
        columns: [{name: 'payload_json', type: 'JSON'}],
        rowCount: 1,
      },
      {
        table: {database: 'custom_meta', schema: 'main', table: 'crdt_updates'},
        isView: false,
        columns: [{name: 'snapshot', type: 'BLOB'}],
        rowCount: 1,
      },
    ],
    sqlSelectToJson,
    getConnector: jest.fn(async () => ({query})),
    refreshTableSchemas: jest.fn(async () => []),
  },
  commands: {
    listCommands,
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
jest.unstable_mockModule('@sqlrooms/room-store', () => ({
  invokeCommandWithPolicy,
}));

const {createCliRoomCapabilities} =
  await import('../createCliRoomCapabilities');

function capability(
  name: string,
  options?: Parameters<typeof createCliRoomCapabilities>[0],
) {
  return createCliRoomCapabilities(options).find(
    (entry) => entry.name === name,
  )!;
}

async function flushQueuedInvocations() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  query.mockClear();
  sqlSelectToJson.mockClear();
  state.db.refreshTableSchemas.mockClear();
  invokeCommandWithPolicy.mockClear();
  listCommands.mockClear();
});

describe('CLI room capability handlers', () => {
  test('refreshes schemas and hides default and configured metadata', async () => {
    const result = await capability('list_tables', {
      metaNamespace: 'custom_meta',
    }).execute({}, {surface: 'mcp-http'});

    expect(result).toMatchObject({
      ok: true,
      data: {tables: [{tableId: 'main.main.events'}], totalCount: 1},
    });
    expect(state.db.refreshTableSchemas).toHaveBeenCalledTimes(1);
  });

  test('waits for schema refresh before reading the catalog', async () => {
    let finishRefresh!: () => void;
    state.db.refreshTableSchemas.mockImplementationOnce(
      () =>
        new Promise<never[]>((resolve) => {
          finishRefresh = () => resolve([]);
        }),
    );
    let settled = false;
    const invocation = Promise.resolve(
      capability('list_tables').execute({}, {surface: 'mcp-http'}),
    );
    void invocation.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    finishRefresh();
    await expect(invocation).resolves.toMatchObject({ok: true});
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

  test('denies queries against the configured metadata namespace', async () => {
    sqlSelectToJson.mockResolvedValueOnce({
      error: false,
      statements: [
        {
          node: {
            type: 'SELECT_NODE',
            from_table: {
              type: 'BASE_TABLE',
              catalog_name: '',
              schema_name: 'custom_meta',
              table_name: 'ui_state',
            },
          },
        },
      ],
    });
    const result = await capability('query', {
      metaNamespace: 'custom_meta',
    }).execute(
      {sql: 'SELECT payload_json FROM "custom_meta".ui_state'},
      {surface: 'mcp-http'},
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'query_internal_namespace',
    });
    expect(query).not.toHaveBeenCalled();
  });

  test('allows internal namespace text inside a string literal', async () => {
    const result = await capability('query').execute(
      {sql: "SELECT '__sqlrooms.table' AS value"},
      {surface: 'mcp-http'},
    );

    expect(result).toMatchObject({ok: true});
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('denies dynamic SQL table functions that bypass parsed references', async () => {
    sqlSelectToJson.mockResolvedValueOnce({
      error: false,
      statements: [
        {
          node: {
            type: 'SELECT_NODE',
            from_table: {
              type: 'TABLE_FUNCTION',
              function: {function_name: 'query'},
            },
          },
        },
      ],
    });

    const result = await capability('query').execute(
      {sql: "SELECT * FROM query('SELECT * FROM __sqlrooms.ui_state')"},
      {surface: 'mcp-http'},
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'query_dynamic_table_reference',
    });
    expect(query).not.toHaveBeenCalled();
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

  test('does not expose or execute SQL-bearing commands over MCP', async () => {
    state.commands.listCommands.mockReturnValueOnce([
      {
        id: 'db.create-table-from-query',
        owner: 'test',
        name: 'Create table from query',
        enabled: true,
        visible: true,
        requiresInput: true,
        keystrokes: [],
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
        requiresConfirmation: false,
      },
      {
        id: 'workspace.refresh',
        owner: 'test',
        name: 'Refresh workspace',
        enabled: true,
        visible: true,
        requiresInput: false,
        keystrokes: [],
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
        requiresConfirmation: false,
      },
    ]);
    const discovery = await capability('search_commands').execute(
      {},
      {surface: 'mcp-http'},
    );
    const execution = await capability('execute_command').execute(
      {commandId: 'db.create-table-from-query', input: {query: 'SELECT 1'}},
      {surface: 'mcp-http'},
    );

    expect(discovery).toMatchObject({
      ok: true,
      data: {commands: [{id: 'workspace.refresh'}]},
    });
    expect(execution).toMatchObject({
      ok: false,
      code: 'command_not_found',
    });
    expect(invokeCommandWithPolicy).not.toHaveBeenCalled();
  });

  test('does not execute commands outside the visible MCP catalog', async () => {
    listCommands.mockReturnValueOnce([]);

    const result = await capability('execute_command').execute(
      {commandId: 'workspace.hidden'},
      {surface: 'mcp-http'},
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'command_not_found',
    });
    expect(invokeCommandWithPolicy).not.toHaveBeenCalled();
  });

  test('keeps the command queue occupied until an aborted invocation settles', async () => {
    let finishFirst!: (result: {success: boolean; commandId: string}) => void;
    invokeCommandWithPolicy.mockImplementationOnce(
      async () =>
        await new Promise<{success: boolean; commandId: string}>((resolve) => {
          finishFirst = resolve;
        }),
    );
    const firstController = new AbortController();
    const firstInvocation = capability('execute_command').execute(
      {commandId: 'workspace.stuck'},
      {surface: 'mcp-http', signal: firstController.signal},
    );
    await flushQueuedInvocations();
    expect(invokeCommandWithPolicy).toHaveBeenCalledTimes(1);

    const secondInvocation = capability('execute_command').execute(
      {commandId: 'workspace.refresh'},
      {surface: 'mcp-http'},
    );
    await flushQueuedInvocations();
    expect(invokeCommandWithPolicy).toHaveBeenCalledTimes(1);

    firstController.abort();

    await expect(firstInvocation).resolves.toMatchObject({
      ok: false,
      code: 'command-cancelled',
    });
    await flushQueuedInvocations();
    expect(invokeCommandWithPolicy).toHaveBeenCalledTimes(1);

    finishFirst({success: true, commandId: 'workspace.stuck'});

    await expect(secondInvocation).resolves.toMatchObject({ok: true});
    expect(invokeCommandWithPolicy).toHaveBeenCalledTimes(2);
  });
});
