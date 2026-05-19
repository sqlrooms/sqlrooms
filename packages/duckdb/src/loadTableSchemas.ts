import {
  DataTable,
  DuckDbConnector,
  escapeVal,
  makeQualifiedTableName,
  QualifiedTableName,
  QualifiedSchema,
  TableColumn,
} from '@sqlrooms/duckdb-core';

export type LoadTableSchemasFilterFunction = (
  table: QualifiedTableName,
) => boolean;

export type LoadTableSchemasFilter = {
  schema?: string;
  database?: string;
  table?: string;
};

export type LoadTableSchemasOptions = LoadTableSchemasFilter & {
  filterFunction?: LoadTableSchemasFilterFunction | null;
};

/**
 * Internal helper to load table schemas with optional filter bypass.
 * Used for exact lookups where we don't want the visibility filter to hide results.
 * Omit `filterFunction` to bypass filtering.
 */
export async function loadTableSchemas(
  connector: DuckDbConnector,
  options: LoadTableSchemasOptions = {},
): Promise<DataTable[]> {
  const {filterFunction, ...filter} = options;

  const sql = buildTableSchemasQuery(filter);
  const describeResults = await connector.query(sql);
  const tables: DataTable[] = [];

  for (let i = 0; i < describeResults.numRows; i++) {
    const dataTable = parseTableSchemaRow(describeResults, i);

    // Apply filter (if not provided or null, include all tables)
    if (!filterFunction || filterFunction(dataTable.table)) {
      tables.push(dataTable);
    }
  }

  return tables;
}

/**
 * Load all schemas (including empty ones) grouped with their tables.
 *
 * If provided, `filter` is applied at two layers:
 * - schemas: invoked with a qualified name where `table === ''` (schemas with no
 *   tables are still surfaced this way)
 * - tables: invoked with the full qualified name as in `loadTableSchemas`
 *
 * @param connector - The DuckDB connector
 * @param filter - Optional visibility filter; omit or pass `null` to include everything
 * @returns Schemas grouped by database, each carrying their (filtered) tables
 */
export async function loadSchemasWithTables(
  connector: DuckDbConnector,
  filter?: LoadTableSchemasFilterFunction | null,
): Promise<QualifiedSchema[]> {
  const [tables, schemaRows] = await Promise.all([
    loadTableSchemas(connector, {filterFunction: filter ?? undefined}),
    queryAllSchemas(connector),
  ]);

  const groups = new Map<string, QualifiedSchema>();
  const keyOf = (database: string, schema: string) => `${database}\x00${schema}`;

  for (const {database, schema} of schemaRows) {
    if (filter) {
      const shouldInclude = filter(
        makeQualifiedTableName({database, schema, table: ''}),
      );
      if (!shouldInclude) continue;
    }
    const key = keyOf(database, schema);
    if (!groups.has(key)) {
      groups.set(key, {database, schema, tables: []});
    }
  }

  for (const table of tables) {
    const database = table.database || '';
    const schema = table.schema || '';
    const key = keyOf(database, schema);
    let group = groups.get(key);
    if (!group) {
      group = {database, schema, tables: []};
      groups.set(key, group);
    }
    group.tables.push(table);
  }

  return Array.from(groups.values());
}

async function queryAllSchemas(
  connector: DuckDbConnector,
): Promise<Array<{database: string; schema: string}>> {
  const sql = `
    SELECT DISTINCT
      COALESCE(
        NULLIF(CAST(database_name AS VARCHAR), ''),
        current_database()
      ) AS database,
      CAST(schema_name AS VARCHAR) AS schema
    FROM duckdb_schemas()
    WHERE (database_name IS NULL OR database_name != 'system')
      AND (internal = false OR CAST(schema_name AS VARCHAR) = 'main')
      AND schema_name IS NOT NULL
    ORDER BY 1, 2
  `;
  const result = await connector.query(sql);
  const out: Array<{database: string; schema: string}> = [];
  for (let i = 0; i < result.numRows; i++) {
    const database = result.getChild('database')?.get(i);
    const schema = result.getChild('schema')?.get(i);
    if (schema == null || database == null) continue;
    const schemaStr = String(schema).trim();
    const databaseStr = String(database).trim();
    if (schemaStr === '' || databaseStr === '') continue;
    out.push({database: databaseStr, schema: schemaStr});
  }
  return out;
}

function isDuckDbPlaceholderViewColumn(
  columnName: string,
  columnType: string,
): boolean {
  return columnName === '__' && columnType.toUpperCase() === 'UNKNOWN';
}

/**
 * Parses a single row from the table schema query results into a DataTable object.
 */
function parseTableSchemaRow(describeResults: any, index: number): DataTable {
  const isView = describeResults.getChild('isView')?.get(index);
  const rowDatabase = describeResults.getChild('database')?.get(index);
  const rowSchema = describeResults.getChild('schema')?.get(index);
  const rowTable = describeResults.getChild('name')?.get(index);
  const sql = describeResults.getChild('sql')?.get(index);
  const comment = describeResults.getChild('comment')?.get(index);
  const estimatedSize = describeResults.getChild('estimated_size')?.get(index);
  const columnNames = describeResults.getChild('column_names')?.get(index);
  const columnTypes = describeResults.getChild('column_types')?.get(index);

  const qualifiedTable = makeQualifiedTableName({
    database: rowDatabase,
    schema: rowSchema,
    table: rowTable,
  });

  const columns: TableColumn[] = [];
  for (let ci = 0; ci < (columnNames?.length ?? 0); ci++) {
    const columnName = String(columnNames.get(ci));
    const columnType = String(columnTypes?.get(ci));
    if (isDuckDbPlaceholderViewColumn(columnName, columnType)) {
      continue;
    }
    columns.push({
      name: columnName,
      type: columnType,
    });
  }

  return {
    table: qualifiedTable,
    database: rowDatabase,
    schema: rowSchema,
    tableName: rowTable,
    columns,
    sql,
    comment,
    isView: Boolean(isView),
    rowCount:
      typeof estimatedSize === 'bigint'
        ? Number(estimatedSize)
        : estimatedSize === null
          ? undefined
          : estimatedSize,
  };
}

function buildMetadataWhereClause(
  nameColumn: string,
  filter: LoadTableSchemasFilter,
): string {
  const {schema, database, table} = filter;
  return [
    database
      ? `database_name = ${escapeVal(database)}`
      : `database_name != 'system'`,
    schema ? `schema_name = ${escapeVal(schema)}` : '',
    table ? `${nameColumn} = ${escapeVal(table)}` : '',
  ]
    .filter(Boolean)
    .join(' AND ');
}

/**
 * Builds the SQL query to load table and view schemas from DuckDB system catalogs.
 * Uses CTEs to efficiently join table/view metadata with column information.
 */
function buildTableSchemasQuery(filter: LoadTableSchemasFilter): string {
  const tableWhereClause = buildMetadataWhereClause('table_name', filter);
  const viewWhereClause = buildMetadataWhereClause('view_name', filter);

  return `WITH tables_and_views AS (
    FROM duckdb_tables() SELECT
      database_name AS database,
      schema_name AS schema,
      table_name AS name,
      sql,
      comment,
      estimated_size,
      FALSE AS isView
    WHERE ${tableWhereClause}
    UNION ALL
    FROM duckdb_views() SELECT
      database_name AS database,
      schema_name AS schema,
      view_name AS name,
      sql,
      comment,
      NULL AS estimated_size,
      TRUE AS isView
    WHERE ${viewWhereClause}
  ),
  columns AS (
    FROM duckdb_columns() SELECT
      database_name AS database,
      schema_name AS schema,
      table_name AS name,
      list(column_name ORDER BY column_index) AS column_names,
      list(data_type ORDER BY column_index) AS column_types
    WHERE ${tableWhereClause}
    GROUP BY database_name, schema_name, table_name
  )
  SELECT
    isView,
    database,
    schema,
    name,
    column_names,
    column_types,
    sql,
    comment,
    estimated_size
  FROM tables_and_views
  LEFT JOIN columns USING (database, schema, name)
  ORDER BY isView, database, schema, name`;
}
