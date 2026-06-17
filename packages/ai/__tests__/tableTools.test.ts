import type {DataTable, QualifiedTableName} from '@sqlrooms/duckdb';
import {
  createTableIdentitySummary,
  formatAmbiguousTableMessage,
  resolveTableFromCatalog,
} from '../src/tools/tables/tableIdentity';
import {createListTablesTool} from '../src/tools/tables/listTables';

function makeTable(
  tableName: string,
  options: {
    database?: string;
    schema?: string;
    isView?: boolean;
    columns?: {name: string; type: string}[];
  } = {},
): DataTable {
  const table = makeQualifiedTableName({
    database: options.database,
    schema: options.schema ?? 'main',
    table: tableName,
  });
  return {
    table,
    isView: options.isView ?? false,
    database: options.database,
    schema: options.schema ?? 'main',
    tableName,
    columns: options.columns ?? [{name: 'id', type: 'INTEGER'}],
  };
}

function quoteIdentifier(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

function makeQualifiedTableName({
  database,
  schema,
  table,
}: QualifiedTableName): QualifiedTableName {
  const tableId = [database, schema, table]
    .filter((id) => id !== undefined && id !== null)
    .map((id) => quoteIdentifier(id))
    .join('.');
  return {
    database,
    schema,
    table,
    toString: () => tableId,
  };
}

describe('table identity helpers', () => {
  it('lists usable quoted canonical table ids', async () => {
    const summary = createTableIdentitySummary(
      makeTable('earthquakes', {database: 'local'}),
    );

    expect(summary).toMatchObject({
      tableId: '"local"."main"."earthquakes"',
      tableName: 'earthquakes',
    });
  });

  it('resolves a unique bare table name to its quoted canonical table id', async () => {
    const result = resolveTableFromCatalog(
      [makeTable('earthquakes', {database: 'local'})],
      'earthquakes',
    );

    expect(result.table?.table.toString()).toBe('"local"."main"."earthquakes"');
  });

  it('does not silently resolve ambiguous bare table names', async () => {
    const result = resolveTableFromCatalog(
      [
        makeTable('earthquakes', {database: 'local'}),
        makeTable('earthquakes', {database: 'remote'}),
      ],
      'earthquakes',
    );
    const message = formatAmbiguousTableMessage(
      'earthquakes',
      result.ambiguousMatches ?? [],
    );

    expect(result.table).toBeUndefined();
    expect(result.ambiguousMatches).toHaveLength(2);
    expect(message).toContain('Table "earthquakes" is ambiguous');
    expect(message).toContain('"local"."main"."earthquakes"');
    expect(message).toContain('"remote"."main"."earthquakes"');
  });

  it('lets canonical identity matches win over ambiguous bare names', async () => {
    const result = resolveTableFromCatalog(
      [
        makeTable('earthquakes', {database: 'local'}),
        makeTable('earthquakes', {database: 'remote'}),
      ],
      '"remote"."main"."earthquakes"',
    );

    expect(result.table?.table.database).toBe('remote');
    expect(result.ambiguousMatches).toBeUndefined();
  });

  it('list_tables includes views from the flat table catalog', async () => {
    const table = makeTable('events', {database: 'local'});
    const view = makeTable('event_summary', {
      database: 'local',
      isView: true,
    });
    const tool = createListTablesTool({
      getState: () => ({
        db: {
          tables: [table, view],
          schemaTrees: [],
        },
      }),
    } as any);

    const includeViewsResult = await (tool as any).execute({
      includeViews: true,
    });
    const excludeViewsResult = await (tool as any).execute({
      includeViews: false,
    });

    expect(
      includeViewsResult.llmResult.tables.map(
        (item: {tableName: string}) => item.tableName,
      ),
    ).toEqual(['event_summary', 'events']);
    expect(
      excludeViewsResult.llmResult.tables.map(
        (item: {tableName: string}) => item.tableName,
      ),
    ).toEqual(['events']);
    expect(includeViewsResult.llmResult.tables).toContainEqual(
      expect.objectContaining({
        tableId: '"local"."main"."event_summary"',
        isView: true,
      }),
    );
  });
});
