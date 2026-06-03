import type {DataTable, TableColumn} from '@sqlrooms/duckdb';

export type TableSchemaContextLimits = {
  fullSchemaThreshold?: number;
  namesOnlyThreshold?: number;
};

export type AiTableScope = 'main' | 'current_database' | 'all';

export type AiTableScopeOptions = {
  scope?: AiTableScope;
  schema?: string;
  database?: string;
};

export const DEFAULT_TABLE_SCHEMA_CONTEXT_LIMITS = {
  fullSchemaThreshold: 5,
  namesOnlyThreshold: 25,
} as const satisfies Required<TableSchemaContextLimits>;

export type AiTableScopeSummary = {
  currentDatabaseMainSchemaTableCount: number;
  outsideCurrentDatabaseMainSchemaCount: number;
  otherCurrentDatabaseSchemaCount: number;
  otherDatabaseCount: number;
  outsideCurrentDatabaseMainSchemaByLocation: {
    database?: string;
    schema?: string;
    count: number;
  }[];
};

export function getAiTableSchemaContextLimits(
  limits?: TableSchemaContextLimits,
) {
  const fullSchemaThreshold =
    limits?.fullSchemaThreshold ??
    DEFAULT_TABLE_SCHEMA_CONTEXT_LIMITS.fullSchemaThreshold;
  const namesOnlyThreshold =
    limits?.namesOnlyThreshold ??
    DEFAULT_TABLE_SCHEMA_CONTEXT_LIMITS.namesOnlyThreshold;

  return {
    fullSchemaThreshold,
    namesOnlyThreshold: Math.max(namesOnlyThreshold, fullSchemaThreshold),
  };
}

export function getTableNameForAi(table: DataTable): string {
  return table.table?.table || table.tableName;
}

export function getSchemaNameForAi(table: DataTable): string | undefined {
  return table.table?.schema || table.schema;
}

export function getDatabaseNameForAi(table: DataTable): string | undefined {
  return table.table?.database || table.database;
}

export function getFullTableNameForAi(table: DataTable): string {
  const tableName = getTableNameForAi(table);
  const schemaName = getSchemaNameForAi(table);
  return schemaName && schemaName !== 'main'
    ? `${schemaName}.${tableName}`
    : tableName;
}

function isTableInAiScope(
  table: DataTable,
  currentDatabase?: string,
  options: AiTableScopeOptions = {},
): boolean {
  const {scope = 'main', schema, database} = options;
  const tableSchema = getSchemaNameForAi(table);
  const tableDatabase = getDatabaseNameForAi(table);

  if (database && tableDatabase !== database) return false;
  if (schema && tableSchema !== schema) return false;
  if (!database && scope !== 'all') {
    if (tableDatabase && tableDatabase !== currentDatabase) return false;
  }
  if (!schema && scope === 'main') {
    if (tableSchema && tableSchema !== 'main') return false;
  }
  return true;
}

export function getTablesForAiScope(
  tables: DataTable[],
  currentDatabase?: string,
  options?: AiTableScopeOptions,
): DataTable[] {
  return tables.filter((table) =>
    isTableInAiScope(table, currentDatabase, options),
  );
}

export function getAiTableScopeSummary(
  tables: DataTable[],
  currentDatabase?: string,
): AiTableScopeSummary {
  const currentMainSchemaTables = getTablesForAiScope(tables, currentDatabase, {
    scope: 'main',
  });
  const outsideCurrentDatabaseMainSchemaTables = getTablesForAiScope(
    tables,
    currentDatabase,
    {scope: 'all'},
  ).filter(
    (table) => !isTableInAiScope(table, currentDatabase, {scope: 'main'}),
  );
  const byLocation = new Map<
    string,
    {database?: string; schema?: string; count: number}
  >();

  for (const table of outsideCurrentDatabaseMainSchemaTables) {
    const database = getDatabaseNameForAi(table);
    const schema = getSchemaNameForAi(table);
    const key = `${database ?? ''}\x00${schema ?? ''}`;
    const existing = byLocation.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byLocation.set(key, {database, schema, count: 1});
    }
  }

  return {
    currentDatabaseMainSchemaTableCount: currentMainSchemaTables.length,
    outsideCurrentDatabaseMainSchemaCount:
      outsideCurrentDatabaseMainSchemaTables.length,
    otherCurrentDatabaseSchemaCount:
      outsideCurrentDatabaseMainSchemaTables.filter((table) => {
        const database = getDatabaseNameForAi(table);
        return !database || database === currentDatabase;
      }).length,
    otherDatabaseCount: outsideCurrentDatabaseMainSchemaTables.filter(
      (table) => {
        const database = getDatabaseNameForAi(table);
        return database && database !== currentDatabase;
      },
    ).length,
    outsideCurrentDatabaseMainSchemaByLocation: Array.from(
      byLocation.values(),
    ).sort(
      (a, b) =>
        (a.database ?? '').localeCompare(b.database ?? '') ||
        (a.schema ?? '').localeCompare(b.schema ?? ''),
    ),
  };
}

function formatScopeLocation(location: {
  database?: string;
  schema?: string;
  count: number;
}): string {
  const parts = [
    location.database ? `database ${location.database}` : 'current database',
    location.schema ? `schema ${location.schema}` : 'unknown schema',
  ];
  return `${parts.join(', ')}: ${location.count.toLocaleString()}`;
}

export function formatOtherTableScopesForAi(
  tables: DataTable[],
  currentDatabase?: string,
): string {
  const summary = getAiTableScopeSummary(tables || [], currentDatabase);
  if (summary.outsideCurrentDatabaseMainSchemaCount === 0) return '';

  const locationSummary = summary.outsideCurrentDatabaseMainSchemaByLocation
    .slice(0, 8)
    .map(formatScopeLocation)
    .join('; ');
  const hiddenLocationCount =
    summary.outsideCurrentDatabaseMainSchemaByLocation.length > 8
      ? `; ${(
          summary.outsideCurrentDatabaseMainSchemaByLocation.length - 8
        ).toLocaleString()} more locations`
      : '';

  return [
    `${summary.outsideCurrentDatabaseMainSchemaCount.toLocaleString()} additional visible tables/views exist outside the current local main schema.`,
    `Use list_tables with scope "current_database" or "all", or pass schema/database filters, to inspect them.`,
    locationSummary
      ? `Outside-main locations: ${locationSummary}${hiddenLocationCount}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function formatRowCount(rowCount: DataTable['rowCount']): string | undefined {
  return rowCount !== undefined
    ? `${rowCount.toLocaleString()} rows`
    : undefined;
}

function formatColumnForAi(column: TableColumn): string {
  return column.type ? `${column.name} ${column.type}` : column.name;
}

export function formatTableSchemaForAi(table: DataTable): string {
  const header = [getFullTableNameForAi(table)];
  const rowCount = formatRowCount(table.rowCount);
  if (rowCount) header.push(`[${rowCount}]`);

  const columns = table.columns
    .map((column) => `  ${formatColumnForAi(column)}`)
    .join('\n');
  const comment = table.comment ? `  # ${table.comment}` : '';

  return `${header.join(' ')}\n${columns || '  (no columns available)'}${
    comment ? '\n' + comment : ''
  }`;
}

export function formatTableSummaryForAi(table: DataTable): string {
  const rowCount = formatRowCount(table.rowCount);
  return `- ${getFullTableNameForAi(table)}${rowCount ? ` [${rowCount}]` : ''}`;
}

/**
 * Formats table schema information using a hybrid prompt strategy.
 *
 * For small current-database main-schema catalogs, every table includes full
 * columns. Larger catalogs include full schemas for the first few tables,
 * names/row counts for the next group, and a hidden-table count for the rest.
 */
export function formatTablesForLLM(
  tables: DataTable[],
  currentDatabase?: string,
  limits?: TableSchemaContextLimits,
): string {
  const currentMainSchemaTables = getTablesForAiScope(
    tables || [],
    currentDatabase,
    {scope: 'main'},
  );
  const otherScopes = formatOtherTableScopesForAi(
    tables || [],
    currentDatabase,
  );

  if (currentMainSchemaTables.length === 0) {
    return [
      'No tables available in the current local main schema.',
      otherScopes,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const {fullSchemaThreshold, namesOnlyThreshold} =
    getAiTableSchemaContextLimits(limits);

  if (currentMainSchemaTables.length <= fullSchemaThreshold) {
    return [
      currentMainSchemaTables.map(formatTableSchemaForAi).join('\n\n'),
      otherScopes,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const fullSchemaTables = currentMainSchemaTables.slice(
    0,
    fullSchemaThreshold,
  );
  const summaryLimit = namesOnlyThreshold - fullSchemaThreshold;
  const summaryTables = currentMainSchemaTables.slice(
    fullSchemaThreshold,
    fullSchemaThreshold + summaryLimit,
  );
  const hiddenCount =
    currentMainSchemaTables.length -
    fullSchemaTables.length -
    summaryTables.length;

  return [
    `Full schemas shown for the first ${fullSchemaTables.length} of ${currentMainSchemaTables.length} available tables:`,
    fullSchemaTables.map(formatTableSchemaForAi).join('\n\n'),
    summaryTables.length > 0
      ? [
          'Additional tables shown by name and row count only:',
          summaryTables.map(formatTableSummaryForAi).join('\n'),
        ].join('\n')
      : '',
    hiddenCount > 0
      ? `${hiddenCount.toLocaleString()} more tables are available via list_tables and describe_table_schema.`
      : '',
    otherScopes,
  ]
    .filter(Boolean)
    .join('\n\n');
}
