import {
  getTableIdentity,
  makeQualifiedTableName,
  resolveTableReference,
  type QualifiedTableName,
} from '../src/duckdb-utils';
import {findTableInSchemaTrees} from '../src/schema-tree/schemaTreeUtils';
import {createDbSchemaTrees} from '../src/schema-tree/schemaTree';
import type {DataTable} from '../src/types';

function makeTable(
  tableName: string,
  options: {
    database?: string;
    schema?: string;
    defaultDatabase?: string;
    isView?: boolean;
  } = {},
): DataTable {
  const table = makeQualifiedTableName({
    database: options.database,
    schema: options.schema ?? 'main',
    table: tableName,
    defaultDatabase: options.defaultDatabase,
  });

  return {
    table,
    isView: options.isView ?? false,
    database: options.database,
    schema: options.schema ?? 'main',
    tableName,
    columns: [{name: 'id', type: 'INTEGER'}],
  };
}

describe('resolveTableReference', () => {
  it('resolves canonical quoted table ids', () => {
    const table = makeTable('earthquakes', {database: 'local'});

    const result = resolveTableReference(
      [table],
      getTableIdentity(table.table),
    );

    expect(result.table).toBe(table);
    expect(result.ambiguousMatches).toBeUndefined();
  });

  it('resolves legacy saved-state table reference shapes explicitly', () => {
    const local = makeTable('events', {
      database: 'memory',
      defaultDatabase: 'memory',
    });
    const remote = makeTable('events', {database: 'remote'});
    const catalog = [local, remote];

    expect(resolveTableReference(catalog, '"main"."events"').table).toBe(local);
    expect(
      resolveTableReference(catalog, '"memory"."main"."events"').table,
    ).toBe(local);
    expect(
      resolveTableReference(catalog, '"remote"."main"."events"').table,
    ).toBe(remote);
  });

  it('resolves qualified SQL identifier strings by parts', () => {
    const local = makeTable('earthquakes', {database: 'local'});
    const remote = makeTable('earthquakes', {database: 'remote'});

    const result = resolveTableReference(
      [local, remote],
      'remote.main.earthquakes',
    );

    expect(result.table).toBe(remote);
    expect(result.ambiguousMatches).toBeUndefined();
  });

  it('resolves unique bare table names', () => {
    const table = makeTable('earthquakes', {database: 'local'});

    const result = resolveTableReference([table], 'earthquakes');

    expect(result.table).toBe(table);
    expect(result.ambiguousMatches).toBeUndefined();
  });

  it('returns all matches for ambiguous bare table names', () => {
    const local = makeTable('earthquakes', {database: 'local'});
    const remote = makeTable('earthquakes', {database: 'remote'});

    const result = resolveTableReference([local, remote], 'earthquakes');

    expect(result.table).toBeUndefined();
    expect(result.ambiguousMatches).toEqual([local, remote]);
  });

  it('returns an empty result when no table matches', () => {
    const result = resolveTableReference(
      [makeTable('earthquakes', {database: 'local'})],
      'stations',
    );

    expect(result.table).toBeUndefined();
    expect(result.ambiguousMatches).toBeUndefined();
  });

  it('resolves QualifiedTableName inputs', () => {
    const qualifiedName: QualifiedTableName = makeQualifiedTableName({
      database: 'local',
      schema: 'main',
      table: 'earthquakes',
    });
    const table = makeTable('earthquakes', {database: 'local'});

    const result = resolveTableReference([table], qualifiedName);

    expect(result.table).toBe(table);
  });
});

describe('schema tree table lookup utilities', () => {
  it('keeps findTableInSchemaTrees exact lookup behavior', () => {
    const table = makeTable('earthquakes', {database: 'local'});
    const schemaTrees = createDbSchemaTrees([
      {database: 'local', schema: 'main', tables: [table]},
    ]);

    const result = findTableInSchemaTrees(
      schemaTrees,
      '"local"."main"."earthquakes"',
    );

    expect(result?.table.table).toBe('earthquakes');
  });

  it('returns undefined when findTableInSchemaTrees has no exact match', () => {
    const local = makeTable('earthquakes', {database: 'local'});
    const remote = makeTable('earthquakes', {database: 'remote'});
    const schemaTrees = createDbSchemaTrees([
      {database: 'local', schema: 'main', tables: [local]},
      {database: 'remote', schema: 'main', tables: [remote]},
    ]);

    const result = findTableInSchemaTrees(schemaTrees, 'earthquakes');

    expect(result).toBeUndefined();
  });
});
