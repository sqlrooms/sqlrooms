import {execFileSync} from 'node:child_process';
import {describe, expect, it, jest} from '@jest/globals';
import {tableFromJSON} from 'apache-arrow';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  inspectLocalSelect,
  needsLocalReadApproval,
} from '../src/localSqlPolicy';

// Opt into the real parser contract with an isolated Python engine. No query
// under classification is bound or executed, including file scans and DML CTEs.
const python = process.env.DUCKDB_TEST_PYTHON;
const cases = {
  cteUnicode: 'WITH "K" AS (SELECT 1 AS n) SELECT * FROM k',

  cte: 'WITH counts AS (SELECT value, count(*) AS n FROM workspace.main.sales GROUP BY value) SELECT value, sum(n) FROM counts GROUP BY value',
  cteExternal:
    "WITH counts AS (SELECT * FROM read_csv('/must-not-be-read')) SELECT * FROM counts",
  cteScope:
    'SELECT * FROM hidden WHERE EXISTS (WITH hidden AS (SELECT 1) SELECT * FROM hidden)',

  histogram:
    'SELECT floor(value / 100) * 100, count(*) FROM workspace.main.sales WHERE isfinite(value) GROUP BY 1',
  temporal:
    "SELECT time_bucket(INTERVAL 1 MONTH, TIMESTAMP '2026-01-02'), epoch_ms(TIMESTAMP '2026-01-02')",
  union: 'SELECT 1 UNION ALL SELECT 2',
  ordinary:
    'SELECT upper(lower(label)), sum(value) OVER () FROM workspace.main.sales',
  nested: "SELECT upper(read_text('/must-not-be-read'))",
  window: "SELECT lag(read_text('/must-not-be-read')) OVER ()",
  macro: 'SELECT lower(label) FROM workspace.main.sales',
  dynamic: "SELECT * FROM query_table('__sqlrooms.ui_state')",
  internal: 'SELECT * FROM __sqlrooms.ui_state',
  nestedInternal: 'SELECT * FROM warehouse.__sqlrooms.ui_state',
  deepInternal: 'SELECT * FROM warehouse.__sqlrooms.nested.ui_state',
  attached: 'SELECT * FROM attached.main.sales',
  file: "SELECT * FROM '/must-not-be-read.csv'",
  delete: 'WITH changed AS (DELETE FROM sales RETURNING *) SELECT 1',
  insert: 'WITH changed AS (INSERT INTO sales VALUES (1) RETURNING *) SELECT 1',
  update: 'WITH changed AS (UPDATE sales SET value=0 RETURNING *) SELECT 1',
  recursive:
    'WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM t WHERE x<3) SELECT * FROM t',
};

(python ? describe : describe.skip)(
  'released DuckDB SQL inspection contract',
  () => {
    const results: Record<string, unknown> = python
      ? JSON.parse(
          execFileSync(
            python,
            [
              '-c',
              `
import duckdb, json, sys
with duckdb.connect() as con:
    print(json.dumps({name: json.loads(con.execute('SELECT json_serialize_sql(?)', [sql]).fetchone()[0]) for name, sql in json.loads(sys.argv[1]).items()}))
`,
              JSON.stringify(cases),
            ],
            {encoding: 'utf8'},
          ),
        )
      : {};

    function database(name: keyof typeof cases, macro = false) {
      const query = jest.fn(async (sql: string) => {
        if (sql.includes('duckdb_tables()'))
          return tableFromJSON([
            {
              database_name: 'workspace',
              schema_name: 'main',
              table_name: 'sales',
            },
            {
              database_name: 'attached',
              schema_name: 'main',
              table_name: 'sales',
            },
          ]);
        if (sql.includes('duckdb_views()')) return tableFromJSON([]);
        if (sql.includes('duckdb_functions()'))
          return tableFromJSON([
            ...[
              '+',
              '-',
              '*',
              '/',
              '//',
              '%',
              '**',
              'floor',
              'count_star',
              'isfinite',
              'upper',
              'lower',
              'sum',
              'time_bucket',
              'epoch_ms',
              'to_months',
              'trunc',
            ].map((function_name) => ({
              function_name,
              internal: true,
              function_type: 'scalar',
              has_side_effects: false,
            })),
            ...(macro
              ? [
                  {
                    function_name: 'lower',
                    internal: false,
                    function_type: 'macro',
                    has_side_effects: false,
                  },
                ]
              : []),
          ]);
        throw new Error(`Unexpected SQL execution: ${sql}`);
      });
      const getConnector = jest.fn(async () => ({query}));
      const db = {
        currentDatabase: 'workspace',
        getConnector,
        sqlSelectToJson: async () => results[name],
      } as unknown as DuckDbSliceState['db'];
      return {db, query, getConnector};
    }

    it('admits checked nonrecursive CTEs without granting their aliases to other scopes', async () => {
      for (const [name, expected] of [
        ['cte', false],
        ['cteExternal', true],
        ['cteScope', true],
        ['cteUnicode', true],
      ] as const) {
        const {db} = database(name);
        const statements = await inspectLocalSelect(
          db,
          cases[name],
          '__sqlrooms',
        );
        expect(await needsLocalReadApproval(db, statements)).toBe(expected);
      }
    });
    it('permits verified nested scalar and window expressions', async () => {
      const {db} = database('ordinary');
      const statements = await inspectLocalSelect(
        db,
        cases.ordinary,
        '__sqlrooms',
      );
      expect(await needsLocalReadApproval(db, statements)).toBe(false);
    });

    it('permits builtin temporal chart bins while refusing a shadowing macro', async () => {
      const {db} = database('temporal');
      const statements = await inspectLocalSelect(
        db,
        cases.temporal,
        '__sqlrooms',
      );
      expect(await needsLocalReadApproval(db, statements)).toBe(false);
      const connector = await db.getConnector();
      const original = connector.query;
      connector.query = (async (sql: string) =>
        sql.includes('duckdb_functions()')
          ? tableFromJSON([
              {
                function_name: 'time_bucket',
                internal: false,
                function_type: 'macro',
                has_side_effects: false,
              },
            ])
          : original(sql)) as typeof connector.query;
      db.getConnector = async () => connector;
      expect(await needsLocalReadApproval(db, statements)).toBe(true);
    });

    it('permits verified histogram arithmetic', async () => {
      const {db} = database('histogram');
      const statements = await inspectLocalSelect(
        db,
        cases.histogram,
        '__sqlrooms',
      );
      expect(await needsLocalReadApproval(db, statements)).toBe(false);
    });

    it('permits read-only set operations', async () => {
      const {db} = database('union');
      const statements = await inspectLocalSelect(
        db,
        cases.union,
        '__sqlrooms',
      );
      expect(await needsLocalReadApproval(db, statements)).toBe(false);
    });

    it.each(['nested', 'window', 'attached', 'file', 'recursive'] as const)(
      'requires approval without binding %s',
      async (name) => {
        const {db} = database(name);
        const statements = await inspectLocalSelect(
          db,
          cases[name],
          '__sqlrooms',
        );
        expect(await needsLocalReadApproval(db, statements)).toBe(true);
      },
    );

    it('detects a macro shadowing an ordinary builtin', async () => {
      const {db} = database('macro', true);
      const statements = await inspectLocalSelect(
        db,
        cases.macro,
        '__sqlrooms',
      );
      expect(await needsLocalReadApproval(db, statements)).toBe(true);
    });

    it.each([
      'dynamic',
      'internal',
      'nestedInternal',
      'deepInternal',
      'delete',
      'insert',
      'update',
    ] as const)(
      'rejects %s before even reading catalog metadata',
      async (name) => {
        const {db, getConnector} = database(name);
        await expect(
          inspectLocalSelect(db, cases[name], '__sqlrooms'),
        ).rejects.toThrow();
        expect(getConnector).not.toHaveBeenCalled();
      },
    );
  },
);

it('fails closed on future query node kinds', async () => {
  const getConnector = jest.fn();
  const db = {
    getConnector,
    sqlSelectToJson: async () => ({
      error: false,
      statements: [
        {
          node: {
            type: 'SELECT_NODE',
            cte_map: {query_node: {type: 'FUTURE_QUERY_NODE'}},
          },
        },
      ],
    }),
  } as unknown as DuckDbSliceState['db'];
  await expect(
    inspectLocalSelect(db, 'SELECT 1', '__sqlrooms'),
  ).rejects.toThrow('read-only');
  expect(getConnector).not.toHaveBeenCalled();
});
