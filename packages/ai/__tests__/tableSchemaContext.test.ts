import type {DataTable} from '@sqlrooms/duckdb';
import {
  formatTablesForLLM,
  getTablesForAiScope,
} from '../src/tools/tableSchemaContext';

function makeTable(
  tableName: string,
  options: {
    database?: string;
    schema?: string;
    columns?: {name: string; type?: string}[];
    rowCount?: number;
    comment?: string;
  } = {},
): DataTable {
  return {
    tableName,
    table: {
      database: options.database,
      schema: options.schema ?? 'main',
      table: tableName,
    },
    database: options.database,
    schema: options.schema ?? 'main',
    columns: options.columns ?? [{name: 'id', type: 'INTEGER'}],
    rowCount: options.rowCount,
    comment: options.comment,
  } as DataTable;
}

describe('table schema context formatting', () => {
  it('does not filter by database when currentDatabase is unavailable', () => {
    const tables = [
      makeTable('local_events', {database: 'local'}),
      makeTable('analytics_events', {database: 'analytics', schema: 'main'}),
    ];

    expect(formatTablesForLLM(tables)).toContain('local_events');
    expect(formatTablesForLLM(tables)).toContain('analytics_events');
  });

  it('filters main-scope tables to the current database when known', () => {
    const tables = [
      makeTable('current_events', {database: 'local'}),
      makeTable('attached_events', {database: 'attached'}),
    ];

    expect(
      getTablesForAiScope(tables, 'local', {scope: 'main'}).map(
        (table) => table.tableName,
      ),
    ).toEqual(['current_events']);
  });

  it('keeps all visible tables in all scope when currentDatabase is known', () => {
    const tables = [
      makeTable('current_events', {database: 'local'}),
      makeTable('local_analytics_events', {
        database: 'local',
        schema: 'analytics',
      }),
      makeTable('attached_events', {database: 'attached'}),
    ];

    expect(
      getTablesForAiScope(tables, 'local', {scope: 'all'}).map(
        (table) => table.tableName,
      ),
    ).toEqual(['current_events', 'local_analytics_events', 'attached_events']);
  });

  it('uses hybrid table context for larger catalogs', () => {
    const output = formatTablesForLLM(
      [
        makeTable('events', {
          database: 'local',
          columns: [{name: 'magnitude', type: 'DOUBLE'}],
        }),
        makeTable('stations', {database: 'local'}),
        makeTable('regions', {database: 'local'}),
      ],
      'local',
      {fullSchemaThreshold: 1, namesOnlyThreshold: 2},
    );

    expect(output).toContain('events (tableId: "local"."main"."events")');
    expect(output).toContain('magnitude DOUBLE');
    expect(output).toContain('- stations');
    expect(output).toContain('tableId: "local"."main"."stations"');
    expect(output).toContain('forward the canonical tableId');
    expect(output).toContain(
      '1 more tables are available via list_tables and read_table_schema.',
    );
  });

  it('does not mention unsupported list_tables scope arguments', () => {
    const output = formatTablesForLLM(
      [
        makeTable('events', {database: 'local'}),
        makeTable('remote_events', {database: 'remote'}),
      ],
      'local',
    );

    expect(output).toContain('database, schema, or pattern filters');
    expect(output).not.toContain('scope');
  });

  it('enforces maxChars with a names-only fallback', () => {
    const tables = Array.from({length: 20}, (_, index) =>
      makeTable(`very_long_table_name_${index}`, {
        database: 'local',
        columns: [
          {name: `very_long_column_name_${index}`, type: 'VARCHAR'},
          {name: 'amount', type: 'DOUBLE'},
        ],
        comment: `long table comment ${index}`,
      }),
    );

    const output = formatTablesForLLM(tables, 'local', {maxChars: 240});

    expect(output.length).toBeLessThanOrEqual(240);
    expect(output).toContain('read_table_schema');
    expect(output).not.toContain('very_long_column_name_0');
  });
});
