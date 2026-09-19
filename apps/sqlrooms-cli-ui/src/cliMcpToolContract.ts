import type {RoomCapability} from '@sqlrooms/mcp';

/** Version of the static shared browser/connector tool contract. */
export const CLI_MCP_CONTRACT_VERSION = 1;
/** Default bounded query result size. */
export const DEFAULT_QUERY_ROWS = 200;
/** Maximum bounded query result size. */
export const MAX_QUERY_ROWS = 1_000;
/** Pure metadata consumed by browser handlers and the Python artifact generator. */
export const CLI_MCP_TOOLS = {
  query: {
    name: 'query',
    title: 'Query the room database',
    description:
      'Run one user-approved SQL SELECT query against the live room and return bounded JSON rows. SELECT validation is not a host sandbox.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {type: 'string', minLength: 1},
        maxRows: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_QUERY_ROWS,
          default: DEFAULT_QUERY_ROWS,
        },
      },
      required: ['sql'],
      additionalProperties: false,
    },
    annotations: {untrustedContentHint: true},
  },
  list_tables: {
    name: 'list_tables',
    title: 'List room tables',
    description:
      'List visible tables and views with canonical table IDs for follow-up calls.',
    inputSchema: {
      type: 'object',
      properties: {
        database: {type: 'string'},
        schema: {type: 'string'},
        pattern: {type: 'string', maxLength: 200},
        includeViews: {type: 'boolean', default: true},
      },
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, untrustedContentHint: true},
  },
  read_table_schema: {
    name: 'read_table_schema',
    title: 'Read a table schema',
    description:
      'Read column metadata and the optional CREATE statement for one visible table or view.',
    inputSchema: {
      type: 'object',
      properties: {tableId: {type: 'string', minLength: 1}},
      required: ['tableId'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, untrustedContentHint: true},
  },
  search_commands: {
    name: 'search_commands',
    title: 'Search room commands',
    description:
      'Search the live command registry by intent, then inspect a selected command with get_command.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string', default: ''},
        limit: {type: 'integer', minimum: 1, maximum: 50, default: 10},
      },
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
  },
  get_command: {
    name: 'get_command',
    title: 'Inspect a room command',
    description:
      'Get the current portable schema, availability, and risk metadata for one command.',
    inputSchema: {
      type: 'object',
      properties: {commandId: {type: 'string', minLength: 1}},
      required: ['commandId'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
  },
  execute_command: {
    name: 'execute_command',
    title: 'Execute a room command',
    description:
      'Execute one enabled command against the live room. High-risk and confirmation-gated commands are denied in this release.',
    inputSchema: {
      type: 'object',
      properties: {
        commandId: {type: 'string', minLength: 1},
        input: {},
      },
      required: ['commandId'],
      additionalProperties: false,
    },
    annotations: {destructiveHint: true},
  },
} satisfies Record<string, Omit<RoomCapability, 'execute'>>;
