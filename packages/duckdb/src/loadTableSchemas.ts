import {
  DataTable,
  DuckDbConnector,
  escapeVal,
  makeQualifiedTableName,
  QualifiedTableName,
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

/**
 * Load all schemas from the database (including empty schemas).
 *
 * If provided, `filter` reuses the same `LoadTableSchemasFilterFunction` type as
 * `loadTableSchemas`, but it is invoked with a schema-only qualified name:
 * `database` and `schema` are populated and `table` is an empty string.
 * Filters that rely on a real, non-empty table name may therefore behave
 * differently when used here.
 *
 * @param connector - The DuckDB connector
 * @param filter - Optional filter function applied to schema entries via a qualified name with `table: ''`; omit or pass `null` for no filter
 * @returns An array of {database, schema} objects
 */
export async function loadAllSchemas(
  connector: DuckDbConnector,
  filter?: LoadTableSchemasFilterFunction | null,
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
  const schemas: Array<{database: string; schema: string}> = [];

  for (let i = 0; i < result.numRows; i++) {
    const database = result.getChild('database')?.get(i);
    const schema = result.getChild('schema')?.get(i);

    if (schema == null) continue;
    const schemaStr = String(schema).trim();
    if (schemaStr === '') continue;
    if (database == null) continue;
    const databaseStr = String(database).trim();
    if (databaseStr === '') continue;

    // Apply the same filter function used for tables
    if (filter) {
      const shouldInclude = filter(
        makeQualifiedTableName({
          database: databaseStr,
          schema: schemaStr,
          table: '',
        }),
      );
      if (!shouldInclude) continue;
    }

    schemas.push({database: databaseStr, schema: schemaStr});
  }

  return schemas;
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
