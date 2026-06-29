import {
  getFullTableIdentity,
  getRawSqlTableReference,
  getTableDisplayName,
  getTableIdentity,
  getUnqualifiedSqlIdentifier,
  makeQualifiedTableName,
  parseFullTableIdentity,
  parseQualifiedSqlIdentifier,
  parseTableIdentity,
  parseTableIdentityToQualifiedName,
  quoteParsedRawSqlTableReference,
  quoteTableReference,
} from '../src/duckdb-utils';

describe('makeQualifiedTableName', () => {
  it('returns database, schema, and table parts by default', () => {
    const table = makeQualifiedTableName({
      database: 'local',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(table.toArray()).toEqual(['local', 'main', 'earthquakes']);
  });

  it('returns schema and table when no database is present', () => {
    const table = makeQualifiedTableName({
      schema: 'main',
      table: 'earthquakes',
    });

    expect(table.toArray()).toEqual(['main', 'earthquakes']);
  });

  it('returns table only when no database or schema is present', () => {
    const table = makeQualifiedTableName({table: 'earthquakes'});

    expect(table.toArray()).toEqual(['earthquakes']);
  });

  it('can omit the database part', () => {
    const table = makeQualifiedTableName({
      database: 'local',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(table.toArray({includeDatabase: false})).toEqual([
      'main',
      'earthquakes',
    ]);
  });

  it('can omit the schema part', () => {
    const table = makeQualifiedTableName({
      database: 'local',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(table.toArray({includeSchema: false})).toEqual([
      'local',
      'earthquakes',
    ]);
  });

  it('can omit database and schema together', () => {
    const table = makeQualifiedTableName({
      database: 'local',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(
      table.toArray({includeDatabase: false, includeSchema: false}),
    ).toEqual(['earthquakes']);
  });

  it('keeps raw dotted and quoted identifier parts in arrays', () => {
    const table = makeQualifiedTableName({
      database: 'local.db',
      schema: 'ma"in',
      table: 'events.2026',
    });

    expect(table.toArray()).toEqual(['local.db', 'ma"in', 'events.2026']);
    expect(table.toString()).toBe('"local.db"."ma""in"."events.2026"');
  });

  it('omits the default database from the canonical string', () => {
    const table = makeQualifiedTableName({
      database: 'local',
      defaultDatabase: 'local',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(table.toString()).toBe('"main"."earthquakes"');
    expect(table.toFullString()).toBe('"local"."main"."earthquakes"');
  });

  it('keeps non-default databases in the canonical string', () => {
    const table = makeQualifiedTableName({
      database: 'remote',
      defaultDatabase: 'local',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(table.toString()).toBe('"remote"."main"."earthquakes"');
    expect(table.toFullString()).toBe('"remote"."main"."earthquakes"');
  });
});

describe('parseQualifiedSqlIdentifier', () => {
  it('returns undefined for empty input', () => {
    expect(parseQualifiedSqlIdentifier(undefined)).toBeUndefined();
    expect(parseQualifiedSqlIdentifier('')).toBeUndefined();
    expect(parseQualifiedSqlIdentifier('   ')).toBeUndefined();
  });

  it('parses unqualified, schema-qualified, and database-qualified names', () => {
    expect(parseQualifiedSqlIdentifier('events')).toEqual({table: 'events'});
    expect(parseQualifiedSqlIdentifier('main.events')).toEqual({
      schema: 'main',
      table: 'events',
    });
    expect(parseQualifiedSqlIdentifier('memory.main.events')).toEqual({
      database: 'memory',
      schema: 'main',
      table: 'events',
    });
  });

  it('handles dots and escaped quotes inside quoted identifier segments', () => {
    expect(
      parseQualifiedSqlIdentifier('"memory"."ma.in"."event""log.2026"'),
    ).toEqual({
      database: 'memory',
      schema: 'ma.in',
      table: 'event"log.2026',
    });
  });

  it('returns undefined for names with too many unquoted segments', () => {
    expect(parseQualifiedSqlIdentifier('a.b.c.d')).toBeUndefined();
  });

  it('returns undefined for malformed names', () => {
    expect(parseQualifiedSqlIdentifier('schema.')).toBeUndefined();
    expect(parseQualifiedSqlIdentifier('schema."events')).toBeUndefined();
  });
});

describe('table reference boundary helpers', () => {
  const table = makeQualifiedTableName({
    database: 'memory',
    defaultDatabase: 'memory',
    schema: 'main',
    table: 'events.2026',
  });
  const attachedTable = makeQualifiedTableName({
    database: 'remote',
    defaultDatabase: 'memory',
    schema: 'main',
    table: 'events.2026',
  });

  it('creates canonical and full table identities from structured names', () => {
    expect(getTableIdentity(table)).toBe('"main"."events.2026"');
    expect(getFullTableIdentity(table)).toBe('"memory"."main"."events.2026"');
    expect(getTableIdentity(attachedTable)).toBe(
      '"remote"."main"."events.2026"',
    );
  });

  it('strictly rehydrates persisted canonical identity strings', () => {
    expect(parseTableIdentity('"main"."events.2026"')).toBe(
      '"main"."events.2026"',
    );
    expect(parseTableIdentity('"remote"."main"."events.2026"')).toBe(
      '"remote"."main"."events.2026"',
    );
    expect(parseTableIdentity('main.events')).toBeUndefined();
    expect(parseTableIdentity('events')).toBeUndefined();
    expect(parseTableIdentity('')).toBeUndefined();
    expect(parseTableIdentity('   ')).toBeUndefined();
  });

  it('rehydrates only fully qualified full table identities', () => {
    expect(parseFullTableIdentity('"memory"."main"."events.2026"')).toBe(
      '"memory"."main"."events.2026"',
    );
    expect(parseFullTableIdentity('"main"."events.2026"')).toBeUndefined();
  });

  it('converts rehydrated identities back to structured table names', () => {
    const identity = parseTableIdentity('"main"."events.2026"');

    expect(identity).toBeDefined();
    expect(parseTableIdentityToQualifiedName(identity!)?.toArray()).toEqual([
      'main',
      'events.2026',
    ]);
  });

  it('creates raw SQL table references from structured names', () => {
    expect(getRawSqlTableReference(table)).toBe('"main"."events.2026"');
    expect(getRawSqlTableReference(attachedTable)).toBe(
      '"remote"."main"."events.2026"',
    );
  });

  it('quotes parsed legacy raw SQL table references explicitly', () => {
    expect(quoteParsedRawSqlTableReference('main.events')).toBe(
      '"main"."events"',
    );
    expect(
      quoteParsedRawSqlTableReference('"memory"."main"."events.2026"'),
    ).toBe('"memory"."main"."events.2026"');
    expect(quoteParsedRawSqlTableReference('')).toBeUndefined();
    expect(quoteParsedRawSqlTableReference('main.')).toBeUndefined();
  });

  it('returns display-only table names', () => {
    expect(getTableDisplayName(table)).toBe('events.2026');
  });
});

describe('getUnqualifiedSqlIdentifier', () => {
  it('returns undefined for empty input', () => {
    expect(getUnqualifiedSqlIdentifier(undefined)).toBeUndefined();
    expect(getUnqualifiedSqlIdentifier('')).toBeUndefined();
    expect(getUnqualifiedSqlIdentifier('   ')).toBeUndefined();
  });

  it('keeps an unqualified identifier unchanged', () => {
    expect(getUnqualifiedSqlIdentifier('result_1')).toBe('result_1');
  });

  it('extracts last segment from qualified names', () => {
    expect(getUnqualifiedSqlIdentifier('schema.result_1')).toBe('result_1');
    expect(getUnqualifiedSqlIdentifier('db.schema.result_1')).toBe('result_1');
  });

  it('handles dots inside quoted identifiers', () => {
    expect(getUnqualifiedSqlIdentifier('myschema."my.funny.table"')).toBe(
      'my.funny.table',
    );
    expect(
      getUnqualifiedSqlIdentifier('db."sch.ema"."ta.ble.with.more.dots"'),
    ).toBe('ta.ble.with.more.dots');
  });

  it('unescapes doubled quotes in quoted identifiers', () => {
    expect(getUnqualifiedSqlIdentifier('myschema."my""table"')).toBe(
      'my"table',
    );
  });
});

describe('quoteTableReference', () => {
  it('quotes bare table names', () => {
    expect(quoteTableReference('earthquakes')).toBe('"earthquakes"');
  });

  it('quotes unquoted qualified table names', () => {
    expect(quoteTableReference('local.main.earthquakes')).toBe(
      '"local"."main"."earthquakes"',
    );
  });

  it('does not double quote pre-quoted qualified table names', () => {
    expect(quoteTableReference('"local"."main"."earthquakes"')).toBe(
      '"local"."main"."earthquakes"',
    );
  });

  it('keeps dots inside quoted identifier segments', () => {
    expect(quoteTableReference('"local"."main"."earthquakes.v1"')).toBe(
      '"local"."main"."earthquakes.v1"',
    );
  });
});
