import {
  DataTable,
  DuckDbConnector,
  escapeVal,
  makeQualifiedTableName,
  QualifiedTableName,
  SchemaWithTables,
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

export type SchemaCatalogFilterEntry =
  | {type: 'database'; database: string}
  | {type: 'schema'; database: string; schema: string}
  | {type: 'table'; table: QualifiedTableName};

export type LoadSchemaCatalogFilterFunction = (
  entry: SchemaCatalogFilterEntry,
) => boolean;

export type LoadSchemaCatalogOptions = LoadTableSchemasFilter & {
  filterFunction?: LoadSchemaCatalogFilterFunction | null;
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
 * Load the visible DuckDB schema catalog in one metadata query.
 * Starts from schemas, then left-joins tables, views, and columns so empty
 * schemas and empty attached database `main` schemas are preserved.
 */
export async function loadSchemaCatalog(
  connector: DuckDbConnector,
  options: LoadSchemaCatalogOptions = {},
): Promise<SchemaWithTables[]> {
  const {filterFunction, ...filter} = options;
  const result = await connector.query(buildSchemaCatalogQuery(filter));
  const groups = new Map<string, SchemaWithTables>();
  const includedDatabases = new Set<string>();
  const keyOf = (database: string, schema: string) =>
    `${database}\x00${schema}`;

  for (let i = 0; i < result.numRows; i++) {
    const database = String(result.getChild('database')?.get(i) ?? '').trim();
    const schema = String(result.getChild('schema')?.get(i) ?? '').trim();
    if (!database || !schema) continue;

    if (!includedDatabases.has(database)) {
      if (filterFunction?.({type: 'database', database}) === false) {
        continue;
      } else {
        includedDatabases.add(database);
      }
    }

    if (filterFunction?.({type: 'schema', database, schema}) === false) {
      continue;
    }

    const key = keyOf(database, schema);
    let group = groups.get(key);

    if (!group) {
      group = {database, schema, tables: []};
      groups.set(key, group);
    }

    const table = parseSchemaCatalogTableRow(result, i);
    if (
      table &&
      (!filterFunction || filterFunction({type: 'table', table: table.table}))
    ) {
      group.tables.push(table);
    }
  }

  return Array.from(groups.values());
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

function parseSchemaCatalogTableRow(
  result: any,
  index: number,
): DataTable | null {
  const rowTable = result.getChild('name')?.get(index);
  if (rowTable == null) return null;
  return parseTableSchemaRow(result, index);
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

function buildSchemaWhereClause(filter: LoadTableSchemasFilter): string {
  const {schema, database} = filter;
  return [
    database
      ? `database_name = ${escapeVal(database)}`
      : `database_name != 'system'`,
    schema ? `schema_name = ${escapeVal(schema)}` : 'schema_name IS NOT NULL',
    `(internal = false OR schema_name = 'main')`,
  ]
    .filter(Boolean)
    .join(' AND ');
}

function buildSchemaCatalogQuery(filter: LoadTableSchemasFilter): string {
  const schemaWhereClause = buildSchemaWhereClause(filter);
  const tableWhereClause = buildMetadataWhereClause('table_name', filter);
  const viewWhereClause = buildMetadataWhereClause('view_name', filter);

  return `WITH schemas AS (
    FROM duckdb_schemas() SELECT DISTINCT
      COALESCE(
        NULLIF(CAST(database_name AS VARCHAR), ''),
        current_database()
      ) AS database,
      CAST(schema_name AS VARCHAR) AS schema
    WHERE ${schemaWhereClause}
  ),
  tables_and_views AS (
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
    tables_and_views.isView AS isView,
    schemas.database AS database,
    schemas.schema AS schema,
    tables_and_views.name AS name,
    columns.column_names AS column_names,
    columns.column_types AS column_types,
    tables_and_views.sql AS sql,
    tables_and_views.comment AS comment,
    tables_and_views.estimated_size AS estimated_size
  FROM schemas
  LEFT JOIN tables_and_views USING (database, schema)
  LEFT JOIN columns USING (database, schema, name)
  ORDER BY schemas.database, schemas.schema, tables_and_views.isView, tables_and_views.name`;
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
