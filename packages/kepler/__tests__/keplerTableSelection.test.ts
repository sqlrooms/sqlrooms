import type {DataTable} from '../../duckdb-core/src/types';
import {makeQualifiedTableName} from '../../duckdb-core/src/duckdb-utils';
import {
  buildKeplerTableLayerOptions,
  findKeplerTableForDatasetId,
  getKeplerDatasetIdForTable,
  getKeplerTableLabel,
  shouldIncludeKeplerTable,
} from '../src/keplerTableSelection';

function createTable(
  database: string,
  schema: string,
  tableName: string,
): DataTable {
  const table = makeQualifiedTableName({
    database,
    schema,
    table: tableName,
  });

  return {
    table,
    database,
    schema,
    tableName,
    isView: false,
    columns: [],
  };
}

describe('keplerTableSelection', () => {
  const defaultTable = createTable('project_db', 'main', 'world_countries');
  const otherSchemaTable = createTable(
    'project_db',
    'countries_schema',
    'countries_table',
  );
  const attachedTable = createTable('attached_db', 'main', 'world_countries');

  const defaultDbSchema = {
    database: 'project_db',
    schema: 'main',
  };

  it('uses bare dataset ids for the default database/schema and qualified ids elsewhere', () => {
    const options = {defaultDbSchema};

    expect(getKeplerDatasetIdForTable(defaultTable, options)).toBe(
      'world_countries',
    );
    expect(getKeplerDatasetIdForTable(otherSchemaTable, options)).toBe(
      '"project_db"."countries_schema"."countries_table"',
    );
    expect(getKeplerDatasetIdForTable(attachedTable, options)).toBe(
      '"attached_db"."main"."world_countries"',
    );
  });

  it('builds display labels without SQL quotes while omitting the default reference', () => {
    const options = {defaultDbSchema};

    expect(getKeplerTableLabel(defaultTable, options)).toBe('world_countries');
    expect(getKeplerTableLabel(otherSchemaTable, options)).toBe(
      'countries_schema.countries_table',
    );
    expect(getKeplerTableLabel(attachedTable, options)).toBe(
      'attached_db.world_countries',
    );
  });

  it('resolves saved qualified ids and bare ids in the default schema', () => {
    const tables = [defaultTable, otherSchemaTable, attachedTable];
    const options = {defaultDbSchema};

    expect(
      findKeplerTableForDatasetId(tables, 'world_countries', options),
    ).toBe(defaultTable);
    expect(
      findKeplerTableForDatasetId(
        tables,
        '"project_db"."countries_schema"."countries_table"',
        options,
      ),
    ).toBe(otherSchemaTable);
  });

  it('does not resolve a bare id to a table outside the default schema', () => {
    const tables = [attachedTable];
    const options = {defaultDbSchema};

    expect(
      findKeplerTableForDatasetId(tables, 'world_countries', options),
    ).toBeUndefined();
  });

  it('filters exposed tables and suppresses loaded dataset aliases for excluded tables', () => {
    const options = {
      defaultDbSchema,
      includeTable: (table: DataTable) => table.table.database === 'project_db',
    };

    expect(shouldIncludeKeplerTable(defaultTable, options)).toBe(true);
    expect(shouldIncludeKeplerTable(attachedTable, options)).toBe(false);
    expect(
      findKeplerTableForDatasetId(
        [defaultTable, attachedTable],
        '"attached_db"."main"."world_countries"',
        options,
      ),
    ).toBeUndefined();

    expect(
      buildKeplerTableLayerOptions(
        [defaultTable, attachedTable],
        ['"attached_db"."main"."world_countries"'],
        options,
      ),
    ).toEqual([{label: 'world_countries', value: 'world_countries'}]);
  });

  it('deduplicates already-loaded aliases for exposed tables', () => {
    const options = {defaultDbSchema};

    expect(
      buildKeplerTableLayerOptions(
        [defaultTable],
        ['"project_db"."main"."world_countries"', 'world_countries'],
        options,
      ),
    ).toEqual([{label: 'world_countries', value: 'world_countries'}]);
  });

  it('uses custom dataset ids, table labels, and dataset-id resolution callbacks', () => {
    const tables = [defaultTable, otherSchemaTable];
    const options = {
      getDatasetIdForTable: (table: DataTable) =>
        `duckdb:${table.table.database}:${table.table.schema}:${table.table.table}`,
      getTableLabel: (table: DataTable) =>
        `${table.table.schema} / ${table.table.table}`,
      findTableForDatasetId: (
        availableTables: DataTable[],
        datasetId: string,
      ) =>
        availableTables.find(
          (table) =>
            datasetId ===
            `duckdb:${table.table.database}:${table.table.schema}:${table.table.table}`,
        ),
    };

    expect(getKeplerDatasetIdForTable(otherSchemaTable, options)).toBe(
      'duckdb:project_db:countries_schema:countries_table',
    );
    expect(getKeplerTableLabel(otherSchemaTable, options)).toBe(
      'countries_schema / countries_table',
    );
    expect(
      findKeplerTableForDatasetId(
        tables,
        'duckdb:project_db:countries_schema:countries_table',
        options,
      ),
    ).toBe(otherSchemaTable);
    expect(buildKeplerTableLayerOptions(tables, [], options)).toEqual([
      {
        label: 'countries_schema / countries_table',
        value: 'duckdb:project_db:countries_schema:countries_table',
      },
      {
        label: 'main / world_countries',
        value: 'duckdb:project_db:main:world_countries',
      },
    ]);
  });
});
