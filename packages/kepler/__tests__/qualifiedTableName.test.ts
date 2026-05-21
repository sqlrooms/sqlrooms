import {
  computeKeplerDatasetLabel,
  normalizeIdentifierPart,
  splitQualifiedIdentifier,
} from '../src/qualifiedTableName';

describe('splitQualifiedIdentifier', () => {
  it('splits a single bare identifier', () => {
    expect(splitQualifiedIdentifier('table')).toEqual(['table']);
  });

  it('splits schema.table on the dot', () => {
    expect(splitQualifiedIdentifier('schema.table')).toEqual([
      'schema',
      'table',
    ]);
  });

  it('splits database.schema.table on dots', () => {
    expect(splitQualifiedIdentifier('main.public.users')).toEqual([
      'main',
      'public',
      'users',
    ]);
  });

  it('preserves dots inside double-quoted segments', () => {
    expect(splitQualifiedIdentifier('"my.db"."my.schema"."my.table"')).toEqual([
      '"my.db"',
      '"my.schema"',
      '"my.table"',
    ]);
  });

  it('preserves doubled-quote escapes inside quoted segments', () => {
    // table named: he said "hi"
    expect(splitQualifiedIdentifier('"he said ""hi"""')).toEqual([
      '"he said ""hi"""',
    ]);
  });

  it('mixes quoted and unquoted parts', () => {
    expect(splitQualifiedIdentifier('main."weird.schema".table')).toEqual([
      'main',
      '"weird.schema"',
      'table',
    ]);
  });

  it('returns empty parts for empty string', () => {
    expect(splitQualifiedIdentifier('')).toEqual(['']);
  });

  it('keeps trailing empty part for dangling dot', () => {
    expect(splitQualifiedIdentifier('schema.')).toEqual(['schema', '']);
  });
});

describe('normalizeIdentifierPart', () => {
  it('returns plain identifiers unchanged', () => {
    expect(normalizeIdentifierPart('table')).toBe('table');
  });

  it('strips surrounding double quotes', () => {
    expect(normalizeIdentifierPart('"table"')).toBe('table');
  });

  it('collapses doubled quotes to a single quote', () => {
    expect(normalizeIdentifierPart('"he said ""hi"""')).toBe('he said "hi"');
  });

  it('trims whitespace before quote handling', () => {
    expect(normalizeIdentifierPart('  "table"  ')).toBe('table');
  });

  it('does not unquote when only one side is quoted', () => {
    expect(normalizeIdentifierPart('"table')).toBe('"table');
    expect(normalizeIdentifierPart('table"')).toBe('table"');
  });

  it('preserves dots inside a quoted part', () => {
    expect(normalizeIdentifierPart('"my.table"')).toBe('my.table');
  });
});

describe('computeKeplerDatasetLabel', () => {
  it('returns the bare table name for a single-part identifier', () => {
    expect(computeKeplerDatasetLabel('users')).toBe('users');
  });

  it('drops main schema in a 2-part identifier', () => {
    expect(computeKeplerDatasetLabel('main.users')).toBe('users');
  });

  it('joins non-main schema and table with a space in a 2-part identifier', () => {
    expect(computeKeplerDatasetLabel('analytics.users')).toBe(
      'analytics users',
    );
  });

  it('drops database and main schema in a 3-part identifier', () => {
    expect(computeKeplerDatasetLabel('main.main.users')).toBe('users');
  });

  it('drops database and joins non-main schema with table in a 3-part identifier', () => {
    expect(computeKeplerDatasetLabel('main.analytics.users')).toBe(
      'analytics users',
    );
  });

  it('drops database name even when it is not main', () => {
    expect(computeKeplerDatasetLabel('mydb.public.users')).toBe('public users');
  });

  it('strips DuckDB quotes from each part and drops database', () => {
    expect(computeKeplerDatasetLabel('"mydb"."public"."users"')).toBe(
      'public users',
    );
  });

  it('preserves dots inside a quoted schema identifier', () => {
    expect(computeKeplerDatasetLabel('"mydb"."weird.schema"."t"')).toBe(
      'weird.schema t',
    );
  });

  it('handles doubled-quote escapes in 2-part identifier', () => {
    expect(computeKeplerDatasetLabel('"main"."he said ""hi"""')).toBe(
      'he said "hi"',
    );
  });

  it('falls back to joined parts for >3 segments', () => {
    expect(computeKeplerDatasetLabel('a.b.c.d')).toBe('a.b.c.d');
  });

  it('returns empty when main schema is followed by empty table', () => {
    expect(computeKeplerDatasetLabel('main.')).toBe('');
  });
});
