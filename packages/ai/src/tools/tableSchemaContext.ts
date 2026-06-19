import type {DataTable, TableColumn} from '@sqlrooms/duckdb';

/**
 * Prompt-size limits used when formatting table schema context for an AI model.
 *
 * @property fullSchemaThreshold - Maximum number of scoped tables that can be
 *   shown with complete column schemas before switching to hybrid summaries.
 * @property namesOnlyThreshold - Maximum number of scoped tables to mention in
 *   the hybrid summary before reporting an omitted-table count.
 * @property maxChars - Optional hard character budget for the generated schema
 *   context string.
 */
export type TableSchemaContextLimits = {
  fullSchemaThreshold?: number;
  namesOnlyThreshold?: number;
  maxChars?: number;
};

/**
 * Table visibility scope used when selecting the catalog slice to expose to AI.
 *
 * `main` means the current database's `main` schema, `current_database` means
 * all schemas in the current database, and `all` means every visible table.
 */
export type AiTableScope = 'main' | 'current_database' | 'all';

/**
 * Filters used to select which tables from the catalog are exposed to AI.
 *
 * @property scope - Broad catalog scope to include.
 * @property schema - Optional exact schema name filter.
 * @property database - Optional exact database name filter.
 */
export type AiTableScopeOptions = {
  scope?: AiTableScope;
  schema?: string;
  database?: string;
};

/**
 * Default thresholds for AI table schema context formatting.
 *
 * @returns Default full-schema and names-only table thresholds.
 */
export const DEFAULT_TABLE_SCHEMA_CONTEXT_LIMITS = {
  fullSchemaThreshold: 5,
  namesOnlyThreshold: 25,
} as const satisfies Required<
  Pick<TableSchemaContextLimits, 'fullSchemaThreshold' | 'namesOnlyThreshold'>
>;

/**
 * Count summary for tables outside the current database's `main` schema.
 *
 * Used to tell the model when additional visible tables exist without flooding
 * the prompt with every schema.
 *
 * @property currentDatabaseMainSchemaTableCount - Number of tables in the
 *   current database's `main` schema.
 * @property outsideCurrentDatabaseMainSchemaCount - Number of visible tables
 *   outside the current database's `main` schema.
 * @property otherCurrentDatabaseSchemaCount - Number of visible tables in other
 *   schemas of the current database.
 * @property otherDatabaseCount - Number of visible tables in other databases.
 * @property outsideCurrentDatabaseMainSchemaByLocation - Counts grouped by
 *   database/schema location.
 */
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

/**
 * Normalizes optional AI table schema context limits.
 *
 * @param limits - Optional partial limit overrides.
 * @returns Resolved limits with default thresholds and a names-only threshold
 *   that is never lower than the full-schema threshold.
 */
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
    maxChars: limits?.maxChars,
  };
}

/**
 * Gets the display table name for AI-facing context.
 *
 * @param table - Data table metadata from the DuckDB catalog.
 * @returns The bare table name when available, falling back to `tableName`.
 */
export function getTableNameForAi(table: DataTable): string {
  return table.table?.table || table.tableName;
}

/**
 * Gets the schema name for an AI-visible table.
 *
 * @param table - Data table metadata from the DuckDB catalog.
 * @returns Schema name when known.
 */
export function getSchemaNameForAi(table: DataTable): string | undefined {
  return table.table?.schema || table.schema;
}

/**
 * Gets the database name for an AI-visible table.
 *
 * @param table - Data table metadata from the DuckDB catalog.
 * @returns Database name when known.
 */
export function getDatabaseNameForAi(table: DataTable): string | undefined {
  return table.table?.database || table.database;
}

/**
 * Gets a compact display name for a table in AI-facing summaries.
 *
 * @param table - Data table metadata from the DuckDB catalog.
 * @returns `schema.table` for non-main schemas, otherwise the bare table name.
 */
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
  if (!database && currentDatabase && scope !== 'all') {
    if (tableDatabase && tableDatabase !== currentDatabase) return false;
  }
  if (!schema && scope === 'main') {
    if (tableSchema && tableSchema !== 'main') return false;
  }
  return true;
}

/**
 * Filters a table catalog to the subset that should be exposed in AI context.
 *
 * @param tables - Flat DuckDB table catalog.
 * @param currentDatabase - Name of the active database, when known.
 * @param options - Optional scope and exact database/schema filters.
 * @returns Tables matching the requested AI scope.
 */
export function getTablesForAiScope(
  tables: DataTable[],
  currentDatabase?: string,
  options?: AiTableScopeOptions,
): DataTable[] {
  return tables.filter((table) =>
    isTableInAiScope(table, currentDatabase, options),
  );
}

/**
 * Summarizes visible tables outside the default AI table scope.
 *
 * @param tables - Flat DuckDB table catalog.
 * @param currentDatabase - Name of the active database, when known.
 * @returns Counts for current-main tables and additional locations.
 */
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

/**
 * Formats a compact notice about tables outside the current database's main schema.
 *
 * @param tables - Flat DuckDB table catalog.
 * @param currentDatabase - Name of the active database, when known.
 * @returns Prompt text describing additional visible table locations, or an
 *   empty string when there are no additional scoped tables.
 */
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
    `Use list_tables with database, schema, or pattern filters to inspect them, then forward the resolved canonical tableId rather than only a bare table name.`,
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

/**
 * Formats a table with full column schema for AI context.
 *
 * @param table - Data table metadata to format.
 * @returns Multi-line schema text including display name, canonical table ID,
 *   optional row count, columns, and optional comment.
 */
export function formatTableSchemaForAi(table: DataTable): string {
  const header = [
    `${getFullTableNameForAi(table)} (tableId: ${table.table.toString()})`,
  ];
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

/**
 * Formats a one-line table summary for AI context.
 *
 * @param table - Data table metadata to summarize.
 * @returns Summary line containing display name, canonical table ID, and
 *   optional row count.
 */
export function formatTableSummaryForAi(table: DataTable): string {
  const rowCount = formatRowCount(table.rowCount);
  return `- ${getFullTableNameForAi(
    table,
  )} (tableId: ${table.table.toString()})${rowCount ? ` [${rowCount}]` : ''}`;
}

function fitTextToMaxChars(text: string, maxChars?: number): string {
  if (maxChars === undefined || text.length <= maxChars) return text;
  if (maxChars <= 0) return '';
  return text.slice(0, maxChars);
}

function joinSections(sections: string[]): string {
  return sections.filter(Boolean).join('\n\n');
}

function addSectionWithinBudget(
  sections: string[],
  section: string,
  maxChars: number,
): boolean {
  const candidate = joinSections([...sections, section]);
  if (candidate.length > maxChars) return false;
  sections.push(section);
  return true;
}

function formatBudgetedTableContextForAi(
  currentMainSchemaTables: DataTable[],
  otherScopes: string,
  maxChars: number,
): string {
  const sections = [
    'Schema context trimmed. Users may say bare names; after resolving, forward tableId, the canonical QualifiedTableName.toString() string. It may omit the default database. Use list_tables and read_table_schema with tableId before SQL.',
  ];

  addSectionWithinBudget(
    sections,
    'Available tables shown by tableId only:',
    maxChars,
  );

  let shownCount = 0;
  const tableLines: string[] = [];
  for (const table of currentMainSchemaTables) {
    const nextLines = [...tableLines, formatTableSummaryForAi(table)];
    const nextSections = [...sections, nextLines.join('\n')];
    if (joinSections(nextSections).length > maxChars) break;
    tableLines.push(nextLines[nextLines.length - 1]!);
    shownCount += 1;
  }

  if (tableLines.length > 0) {
    sections.push(tableLines.join('\n'));
  }

  const hiddenCount = currentMainSchemaTables.length - shownCount;
  if (hiddenCount > 0) {
    addSectionWithinBudget(
      sections,
      `${hiddenCount.toLocaleString()} more tables omitted from this prompt. Use list_tables to page through them.`,
      maxChars,
    );
  }

  if (otherScopes) {
    addSectionWithinBudget(sections, otherScopes, maxChars);
  }

  return fitTextToMaxChars(joinSections(sections), maxChars);
}

/**
 * Formats table schema information using a hybrid prompt strategy.
 *
 * For small current-database main-schema catalogs, every table includes full
 * columns. Larger catalogs include full schemas for the first few tables,
 * table IDs/row counts for the next group, and a hidden-table count for the rest.
 *
 * @param tables - Flat DuckDB table catalog to expose.
 * @param currentDatabase - Name of the active database, when known.
 * @param limits - Optional prompt-size thresholds and character budget.
 * @returns AI prompt text that includes usable canonical table IDs and guidance
 *   for resolving bare user table names before downstream tool calls.
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

  const {fullSchemaThreshold, namesOnlyThreshold, maxChars} =
    getAiTableSchemaContextLimits(limits);

  if (currentMainSchemaTables.length <= fullSchemaThreshold) {
    const fullContext = joinSections([
      currentMainSchemaTables.map(formatTableSchemaForAi).join('\n\n'),
      otherScopes,
    ]);
    return fullContext.length <= (maxChars ?? Infinity)
      ? fullContext
      : formatBudgetedTableContextForAi(
          currentMainSchemaTables,
          otherScopes,
          maxChars!,
        );
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

  const hybridContext = joinSections([
    'Users may say bare table names. After choosing a concrete table, forward the canonical tableId shown here, which is the quoted SQLRooms table reference from QualifiedTableName.toString(), rather than only the bare/display name.',
    `Full schemas shown for the first ${fullSchemaTables.length} of ${currentMainSchemaTables.length} available tables:`,
    fullSchemaTables.map(formatTableSchemaForAi).join('\n\n'),
    summaryTables.length > 0
      ? [
          'Additional tables shown by tableId and row count only:',
          summaryTables.map(formatTableSummaryForAi).join('\n'),
        ].join('\n')
      : '',
    hiddenCount > 0
      ? `${hiddenCount.toLocaleString()} more tables are available via list_tables and read_table_schema.`
      : '',
    otherScopes,
  ]);

  return hybridContext.length <= (maxChars ?? Infinity)
    ? hybridContext
    : formatBudgetedTableContextForAi(
        currentMainSchemaTables,
        otherScopes,
        maxChars!,
      );
}
