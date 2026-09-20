import {
  arrowTableToJson,
  parseQualifiedSqlIdentifier,
  type QualifiedTableName,
  type DuckDbSliceState,
} from '@sqlrooms/duckdb';

/** A SQL validation failure safe to return to the invoking client. */
export class CliSqlError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Validate one SELECT without binding or reading any referenced files. */
export async function inspectCliSelect(
  db: DuckDbSliceState['db'],
  sql: string,
  namespace: string,
): Promise<unknown[]> {
  const parsed = await db.sqlSelectToJson(sql.trim());
  if (
    parsed.error ||
    parsed.statements.length !== 1 ||
    parsed.statements[0]?.node.type !== 'SELECT_NODE'
  ) {
    throw new CliSqlError(
      'query_not_readonly',
      parsed.error
        ? parsed.error_message
        : 'Only one SELECT statement is allowed.',
    );
  }
  const references: Record<string, unknown>[] = [];
  visitSql(parsed.statements, (node) => {
    if (node.type === 'BASE_TABLE') references.push(node);
    if (
      node.type === 'BASE_TABLE' &&
      [node.catalog_name, node.schema_name, node.table_name].some((name) =>
        isInternal(name, namespace),
      )
    ) {
      throw new CliSqlError(
        'query_internal_namespace',
        `Access to internal schema ${namespace} is denied.`,
      );
    }
    if (
      typeof node.function_name === 'string' &&
      ['query', 'query_table'].includes(
        String(node.function_name).toLowerCase(),
      )
    ) {
      throw new CliSqlError(
        'query_dynamic_table_reference',
        'Dynamic query and table references are not allowed over MCP.',
      );
    }
  });
  if (references.length) {
    const connector = await db.getConnector();
    const relations = arrowTableToJson(
      await connector.query(
        'SELECT database_name, schema_name, table_name FROM duckdb_tables() UNION ALL SELECT database_name, schema_name, view_name AS table_name FROM duckdb_views()',
      ),
    ) as Record<string, unknown>[];
    // Unqualified references can resolve to a persistence schema through search_path.
    // Validate sources here for both reads and materialization, before approval policy.
    if (
      references.some((reference) =>
        relations.some(
          (relation) =>
            String(reference.table_name).toLowerCase() ===
              String(relation.table_name).toLowerCase() &&
            (!reference.schema_name ||
              String(reference.schema_name).toLowerCase() ===
                String(relation.schema_name).toLowerCase()) &&
            (!reference.catalog_name ||
              String(reference.catalog_name).toLowerCase() ===
                String(relation.database_name).toLowerCase()) &&
            [
              relation.database_name,
              relation.schema_name,
              relation.table_name,
            ].some((name) => isInternal(name, namespace)),
        ),
      )
    )
      throw new CliSqlError(
        'query_internal_namespace',
        'Access to internal SQLRooms relations is denied.',
      );
  }
  return parsed.statements;
}

/** Protect persistence objects from CLI database commands on every surface. */
export function assertCliDestination(
  db: DuckDbSliceState['db'],
  tableName: string,
  namespace: string,
): QualifiedTableName {
  const parsed = parseQualifiedSqlIdentifier(tableName);
  if (!parsed?.table)
    throw new CliSqlError('invalid_table', 'Use a valid SQL table identifier.');
  const table = db.qualifyTableName({...parsed, table: parsed.table});
  if (
    [table.database, table.schema, table.table].some((name) =>
      isInternal(name, namespace),
    )
  ) {
    throw new CliSqlError(
      'query_internal_namespace',
      'Internal SQLRooms relations cannot be modified.',
    );
  }
  return table;
}

function isInternal(value: unknown, namespace: string) {
  return (
    typeof value === 'string' &&
    (value.toLowerCase() === namespace.toLowerCase() ||
      value.toLowerCase().startsWith('__sqlrooms'))
  );
}

function visitSql(
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const child of value) visitSql(child, visit);
    return;
  }
  const node = value as Record<string, unknown>;
  visit(node);
  for (const child of Object.values(node)) visitSql(child, visit);
}

// A conservative convenience policy, not a sandbox. Unknown functions and all
// table functions require approval. Check live metadata too: macros can shadow
// otherwise familiar function names. Never EXPLAIN/bind a file scan to classify it.
const ORDINARY_FUNCTIONS = new Set(
  `count count_star sum avg min max median mode stddev stddev_pop stddev_samp variance var_pop var_samp quantile_cont quantile_disc approx_count_distinct first last any_value string_agg list array_agg abs round ceil ceiling floor sqrt pow power exp ln log log10 sign greatest least lower upper length char_length trim ltrim rtrim concat concat_ws substring substr replace split_part contains starts_with ends_with regexp_matches regexp_replace coalesce ifnull nullif strftime strptime date_part date_trunc datediff date_diff date_add extract year month day hour minute second row_number rank dense_rank percent_rank cume_dist ntile lag lead first_value last_value nth_value`.split(
    ' ',
  ),
);

/** True unless the SELECT can be verified as an ordinary read of physical tables. */
export async function needsCliReadApproval(
  db: DuckDbSliceState['db'],
  statements: unknown[],
): Promise<boolean> {
  const tables: Record<string, unknown>[] = [];
  const functions = new Set<string>();
  let uncertain = false;
  visitSql(statements, (node) => {
    if (node.type === 'BASE_TABLE') tables.push(node);
    if (node.type === 'TABLE_FUNCTION') uncertain = true;
    if (node.class === 'FUNCTION' || node.class === 'WINDOW') {
      const name = String(node.function_name).toLowerCase();
      if (!ORDINARY_FUNCTIONS.has(name) || node.schema || node.catalog)
        uncertain = true;
      functions.add(name);
    }
  });
  if (uncertain) return true;
  if (!tables.length && !functions.size) return false;
  const connector = await db.getConnector();
  if (tables.length) {
    const physical = arrowTableToJson(
      await connector.query(
        'SELECT database_name, schema_name, table_name FROM duckdb_tables()',
      ),
    ) as Record<string, unknown>[];
    for (const table of tables) {
      // Unresolved names (including CTE aliases) are conservative: ask rather
      // than guessing DuckDB's scope/search-path resolution or expanding views.
      const matches = physical.filter(
        (entry) =>
          String(entry.table_name).toLowerCase() ===
            String(table.table_name).toLowerCase() &&
          (!table.schema_name || entry.schema_name === table.schema_name) &&
          (!table.catalog_name || entry.database_name === table.catalog_name),
      );
      if (
        matches.length !== 1 ||
        ![db.currentDatabase, 'temp'].includes(
          String(matches[0]?.database_name),
        )
      )
        return true;
    }
    // A view in another schema may shadow an unqualified physical table.
    const views = arrowTableToJson(
      await connector.query(
        'SELECT database_name, schema_name, view_name FROM duckdb_views()',
      ),
    ) as Record<string, unknown>[];
    if (
      tables.some((table) =>
        views.some(
          (view) =>
            String(view.view_name).toLowerCase() ===
              String(table.table_name).toLowerCase() &&
            (!table.schema_name || table.schema_name === view.schema_name) &&
            (!table.catalog_name || table.catalog_name === view.database_name),
        ),
      )
    )
      return true;
  }
  if (functions.size) {
    const catalog = arrowTableToJson(
      await connector.query(
        'SELECT function_name, internal, function_type, has_side_effects FROM duckdb_functions()',
      ),
    ) as Record<string, unknown>[];
    for (const name of functions) {
      const matches = catalog.filter((entry) => entry.function_name === name);
      if (
        !matches.length ||
        matches.some(
          (entry) =>
            !entry.internal ||
            !['scalar', 'aggregate', 'window'].includes(
              String(entry.function_type),
            ) ||
            entry.has_side_effects,
        )
      )
        return true;
    }
  }
  return false;
}
