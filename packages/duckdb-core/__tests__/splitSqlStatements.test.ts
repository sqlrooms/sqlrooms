import {
  makeLimitQuery,
  separateLastStatement,
  splitSqlStatements,
} from '../src/duckdb-utils';

describe('splitSqlStatements', () => {
  it('ignores semicolons in quoted strings and identifiers', () => {
    expect(
      splitSqlStatements(
        `SELECT 'one;''two' AS value; SELECT "semi;""colon" FROM tbl;`,
      ),
    ).toEqual([
      `SELECT 'one;''two' AS value`,
      `SELECT "semi;""colon" FROM tbl`,
    ]);
  });

  it('ignores semicolons in escape string literals', () => {
    const escapeString = String.raw`SELECT E'one\';two' AS value`;

    expect(splitSqlStatements(`${escapeString}; SELECT 2`)).toEqual([
      escapeString,
      'SELECT 2',
    ]);
  });

  it('ignores semicolons in tagged and untagged dollar-quoted strings', () => {
    const first = `SELECT $$one; -- not a comment$$ AS value`;
    const second = `SELECT $tag_1$two; $$still quoted$$$tag_1$ AS value`;

    expect(splitSqlStatements(`${first}; ${second}; SELECT $1`)).toEqual([
      first,
      second,
      'SELECT $1',
    ]);
  });

  it('handles nested block comments', () => {
    expect(
      splitSqlStatements(
        'SELECT/* outer; /* nested; */ still outer */1; SELECT 2',
      ),
    ).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('does not join tokens when removing comments', () => {
    expect(splitSqlStatements('SELECT/* comment */1')).toEqual(['SELECT 1']);
  });

  it('preserves line breaks when removing comments', () => {
    expect(splitSqlStatements('SELECT 1-- comment;\r\n+ 2; SELECT 3')).toEqual([
      'SELECT 1 \r\n+ 2',
      'SELECT 3',
    ]);
  });

  it('can preserve comments and otherwise original statement text', () => {
    const input = `
      -- setup;
      CREATE TEMP TABLE t AS SELECT 1/* value */;
      -- final;
      SELECT * FROM t;
    `;

    expect(splitSqlStatements(input, {removeComments: false})).toEqual([
      '-- setup;\n      CREATE TEMP TABLE t AS SELECT 1/* value */',
      '-- final;\n      SELECT * FROM t',
    ]);
  });

  it('ignores comment-only and empty segments', () => {
    const input = '-- comment;\n; /* outer /* nested */ comment */;';

    expect(splitSqlStatements(input)).toEqual([]);
    expect(splitSqlStatements(input, {removeComments: false})).toEqual([]);
  });
});

describe('separateLastStatement', () => {
  it('preserves comments when separating statements for rewriting', () => {
    expect(
      separateLastStatement(
        '-- setup\nCREATE TEMP TABLE t AS SELECT 1; SELECT/* final */ * FROM t',
      ),
    ).toEqual({
      precedingStatements: ['-- setup\nCREATE TEMP TABLE t AS SELECT 1'],
      lastStatement: 'SELECT/* final */ * FROM t',
    });
  });

  it('preserves dollar-quoted comment text when rewriting the last statement', () => {
    const query = `SELECT $$one; -- not a comment$$ AS value`;
    const {lastStatement} = separateLastStatement(query);

    expect(
      makeLimitQuery(lastStatement, {limit: 10, sanitize: false}),
    ).toContain(query);
  });
});
