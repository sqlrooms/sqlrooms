import {getTableIdentity, type DataTable} from '@sqlrooms/duckdb';
import {getDefaultValuesForAggregator} from '../src/aggregators';
import {buildCellsQuery, buildPivotExportQuery} from '../src/sql';
import {createDefaultPivotConfig} from '../src/PivotCoreSlice';

const table: DataTable = {
  table: {
    table: 'tips',
    schema: 'main',
    toFullString: () => '"main"."tips"',
    toString: () => '"main"."tips"',
  },
  tableName: 'tips',
  schema: 'main',
  isView: false,
  columns: [
    {name: 'day', type: 'VARCHAR'},
    {name: 'sex', type: 'VARCHAR'},
    {name: 'tip', type: 'DOUBLE'},
    {name: 'total_bill', type: 'DOUBLE'},
  ],
};

describe('pivot SQL helpers', () => {
  it('selects numeric defaults for numeric aggregators', () => {
    expect(
      getDefaultValuesForAggregator({
        aggregatorName: 'Sum over Sum',
        fields: table.columns,
        currentValues: [],
      }),
    ).toEqual(['tip', 'total_bill']);
  });

  it('builds grouped SQL with filters', () => {
    const config = createDefaultPivotConfig({
      tableName: 'tips',
      rows: ['day'],
      cols: ['sex'],
      aggregatorName: 'Sum',
      vals: ['tip'],
      valueFilter: {sex: {Male: true}},
    });

    const sql = buildCellsQuery(config, table);
    expect(sql).toContain('SUM(TRY_CAST("tip" AS DOUBLE))');
    expect(sql).toContain(
      "WHERE COALESCE(CAST(\"sex\" AS VARCHAR), 'null') NOT IN ('Male')",
    );
    expect(sql).toContain('GROUP BY');
  });

  it('builds pivot export SQL with PIVOT statement', () => {
    const config = createDefaultPivotConfig({
      tableName: 'tips',
      rows: ['day'],
      cols: ['sex'],
      aggregatorName: 'Count',
    });

    const sql = buildPivotExportQuery(config, table, ['Female', 'Male']);
    expect(sql).toContain('PIVOT(');
    expect(sql).toContain("FOR \"col_label\" IN ('Female', 'Male')");
  });

  it('does not accept persisted table identities as raw SQL sources', () => {
    const config = createDefaultPivotConfig({tableName: 'tips'});
    const tableIdentity = getTableIdentity(table.table);

    const assertRawSqlSource = () => {
      // @ts-expect-error TableIdentity needs an explicit raw SQL conversion.
      buildCellsQuery(config, tableIdentity);
    };
    void assertRawSqlSource;

    expect(tableIdentity).toBe('"main"."tips"');
  });
});
