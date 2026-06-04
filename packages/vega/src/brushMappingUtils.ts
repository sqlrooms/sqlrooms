import {arrowTableToJson, DuckDbConnector} from '@sqlrooms/duckdb';
import type {BrushFieldMapping} from './VegaChartTool';
import type {VegaBrushSelectionRanges} from './VegaLiteArrowChart';

// ---------------------------------------------------------------------------
// SQL parsing helpers (DuckDB AST via json_serialize_sql)
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a parsed expression node from DuckDB's
 * `json_serialize_sql`. Only the fields we rely on are typed; the full node
 * carries many more properties that we pass through opaquely.
 */
type ParsedExpr = {
  class?: string;
  type?: string;
  alias?: string;
  function_name?: string;
  column_names?: string[];
  children?: ParsedExpr[];
  [key: string]: unknown;
};

/** Minimal shape of a parsed table reference from `json_serialize_sql`. */
type ParsedTableRef = {
  type?: string;
  table_name?: string;
  left?: ParsedTableRef;
  right?: ParsedTableRef;
  [key: string]: unknown;
};

/** Minimal shape of a parsed SELECT statement from `json_serialize_sql`. */
type ParsedSelectStatement = {
  node: {
    type?: string;
    from_table?: ParsedTableRef;
    select_list?: ParsedExpr[];
    where_clause?: unknown;
    group_expressions?: unknown;
    group_sets?: unknown;
    qualify?: unknown;
    having?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ParsedSql =
  | {error: true; [key: string]: unknown}
  | {error: false; statements: ParsedSelectStatement[]};

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Parse a single SQL SELECT statement into DuckDB's JSON AST. Returns `null`
 * when the SQL is invalid or does not contain a SELECT statement.
 */
async function parseSelectStatement(
  connector: DuckDbConnector,
  sql: string,
): Promise<ParsedSelectStatement | null> {
  let parsed: ParsedSql;
  try {
    const result = await connector.query(
      `SELECT json_serialize_sql(${escapeSqlLiteral(sql)}) AS ast`,
    );
    const raw = result?.getChildAt(0)?.get(0);
    if (raw == null) return null;
    parsed = JSON.parse(String(raw)) as ParsedSql;
  } catch {
    return null;
  }
  if (parsed.error) return null;
  const statement = parsed.statements?.[0];
  if (!statement || statement.node?.type !== 'SELECT_NODE') return null;
  return statement;
}

/**
 * Descend a (possibly joined/subqueried) table reference to the leftmost
 * base table and return its unqualified name.
 */
function findBaseTableName(ref: ParsedTableRef | undefined): string | null {
  if (!ref) return null;
  if (ref.type === 'BASE_TABLE' && typeof ref.table_name === 'string') {
    return ref.table_name;
  }
  // JOIN nodes nest into left/right; follow the left side first.
  return findBaseTableName(ref.left) ?? findBaseTableName(ref.right);
}

/**
 * Load the set of aggregate function names known to the connected DuckDB
 * instance (lowercased). Cached per connector since the catalog is stable.
 */
const aggregateNameCache = new WeakMap<DuckDbConnector, Promise<Set<string>>>();

function getAggregateFunctionNames(
  connector: DuckDbConnector,
): Promise<Set<string>> {
  let cached = aggregateNameCache.get(connector);
  if (!cached) {
    cached = (async () => {
      try {
        const result = await connector.query(
          `SELECT DISTINCT lower(function_name) AS n
             FROM duckdb_functions()
            WHERE function_type = 'aggregate'`,
        );
        const rows = arrowTableToJson(result);
        return new Set(rows.map((r) => String(r['n'])));
      } catch {
        return new Set<string>();
      }
    })();
    aggregateNameCache.set(connector, cached);
  }
  return cached;
}

/**
 * Whether a parsed expression contains an aggregate anywhere in its tree
 * (e.g. `SUM(x)`, `COUNT(*)`, or `SUM(x) + 1`).
 */
function exprContainsAggregate(
  expr: ParsedExpr,
  aggregateNames: Set<string>,
): boolean {
  if (
    expr.class === 'FUNCTION' &&
    typeof expr.function_name === 'string' &&
    aggregateNames.has(expr.function_name.toLowerCase())
  ) {
    return true;
  }
  if (Array.isArray(expr.children)) {
    return expr.children.some((child) =>
      exprContainsAggregate(child, aggregateNames),
    );
  }
  return false;
}

/**
 * Derive the output field name for a select-list item: its explicit alias,
 * or the (unqualified) column name for a bare column reference.
 */
function selectItemFieldName(expr: ParsedExpr): string | null {
  if (typeof expr.alias === 'string' && expr.alias.length > 0) {
    return expr.alias;
  }
  if (expr.class === 'COLUMN_REF' && Array.isArray(expr.column_names)) {
    const last = expr.column_names[expr.column_names.length - 1];
    return last ?? null;
  }
  return null;
}

/**
 * Build an AST for `row_number() OVER () - 1 AS __row_idx` by parsing it
 * through the connector, so it matches the connected DuckDB version exactly.
 */
async function buildRowIndexExpr(
  connector: DuckDbConnector,
): Promise<ParsedExpr | null> {
  const statement = await parseSelectStatement(
    connector,
    'SELECT row_number() OVER () - 1 AS __row_idx',
  );
  return statement?.node.select_list?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Extract the primary base table referenced by a SQL SELECT query by parsing
 * it through DuckDB (`json_serialize_sql`). For joins, returns the leftmost
 * base table; for subqueries/CTEs without a base table, returns `null`.
 *
 * This is async because it relies on the DuckDB parser via {@link connector}.
 */
export async function extractTableNameFromSql(
  connector: DuckDbConnector,
  sql: string,
): Promise<string | null> {
  const statement = await parseSelectStatement(connector, sql);
  if (!statement) return null;
  return findBaseTableName(statement.node.from_table);
}

// ---------------------------------------------------------------------------
// Lazy brush mapping computation
// ---------------------------------------------------------------------------

const MAX_BRUSH_MAPPING_ROWS = 100_000;

/**
 * Computes a {@link BrushFieldMapping} for the given chart SQL by querying
 * the source table. Evaluates non-aggregate field expressions against every
 * source row and groups source row indices by each expression's value.
 *
 * The chart SQL is parsed via DuckDB's AST (`json_serialize_sql`) to identify
 * the source table and the non-aggregate select-list expressions. The query
 * used to build the mapping reuses the original `FROM` clause exactly (joins,
 * subqueries, schema-qualified names) but drops `WHERE`/`GROUP BY`/`HAVING`/
 * `QUALIFY` so that every source row is evaluated.
 *
 * Returns `null` when the source table exceeds
 * {@link MAX_BRUSH_MAPPING_ROWS} rows to avoid expensive scans, when the SQL
 * cannot be parsed, or when there are no non-aggregate fields to map.
 */
export async function computeBrushMapping(
  connector: DuckDbConnector,
  chartSql: string,
): Promise<BrushFieldMapping | null> {
  const statement = await parseSelectStatement(connector, chartSql);
  if (!statement) return null;

  const tableName = findBaseTableName(statement.node.from_table);
  if (!tableName) return null;

  const aggregateNames = await getAggregateFunctionNames(connector);
  const selectList = statement.node.select_list ?? [];

  const fieldItems: ParsedExpr[] = [];
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const item of selectList) {
    if (item.class === 'STAR') continue;
    if (exprContainsAggregate(item, aggregateNames)) continue;
    const field = selectItemFieldName(item);
    if (!field || seen.has(field)) continue;
    seen.add(field);
    // Force the output field name to a deterministic alias so we can read it
    // back regardless of how DuckDB would auto-name the column.
    fieldItems.push({...item, alias: field});
    aliases.push(field);
  }
  if (fieldItems.length === 0) return null;

  const escapedTable = `"${tableName.replace(/"/g, '""')}"`;
  const countResult = await connector.query(
    `SELECT COUNT(*) AS cnt FROM ${escapedTable}`,
  );
  const rowCount = Number(countResult?.getChildAt(0)?.get(0) ?? 0);
  if (rowCount > MAX_BRUSH_MAPPING_ROWS) return null;

  const rowIndexExpr = await buildRowIndexExpr(connector);
  if (!rowIndexExpr) return null;

  // Mutate the parsed statement: keep only the row index + non-aggregate
  // fields, and strip clauses that would filter/reduce rows. Deserializing
  // back to SQL lets DuckDB regenerate a correct query (quoting, joins, etc.).
  const projectStatement = JSON.parse(
    JSON.stringify(statement),
  ) as ParsedSelectStatement;
  projectStatement.node.select_list = [rowIndexExpr, ...fieldItems];
  projectStatement.node.where_clause = null;
  projectStatement.node.group_expressions = [];
  projectStatement.node.group_sets = [];
  projectStatement.node.having = null;
  projectStatement.node.qualify = null;

  const serialized = JSON.stringify({error: false, statements: [projectStatement]});
  const deserializeResult = await connector.query(
    `SELECT json_deserialize_sql(${escapeSqlLiteral(serialized)}) AS sql`,
  );
  const projectionSql = deserializeResult?.getChildAt(0)?.get(0);
  if (projectionSql == null) return null;

  const result = await connector.query(String(projectionSql));
  if (!result || result.numRows === 0) return null;

  const rows = arrowTableToJson(result);
  const mapping: BrushFieldMapping = {};
  for (const alias of aliases) {
    mapping[alias] = {};
  }
  for (const row of rows) {
    const rowIdx = Number(row['__row_idx']);
    for (const alias of aliases) {
      const val = row[alias];
      const key = val == null ? '__null__' : String(val);
      const bucket = mapping[alias]!;
      if (!bucket[key]) bucket[key] = [];
      bucket[key]!.push(rowIdx);
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Brush-to-map row resolution
// ---------------------------------------------------------------------------

/**
 * Given a {@link BrushFieldMapping} and the current brush selection ranges,
 * resolves the set of source-table row indices that match all selected fields
 * (intersection across fields).
 */
export function resolveBrushToRowIndices(
  mapping: BrushFieldMapping,
  ranges: VegaBrushSelectionRanges,
): number[] {
  const fieldResults: number[][] = [];

  for (const [field, range] of Object.entries(ranges)) {
    const fieldMap = mapping[field];
    if (!fieldMap) continue;

    if (
      Array.isArray(range) &&
      range.length === 2 &&
      typeof range[0] === 'number' &&
      typeof range[1] === 'number'
    ) {
      const min = range[0];
      const max = range[1];
      const indices: number[] = [];
      for (const [key, rowIndices] of Object.entries(fieldMap)) {
        const numVal = Number(key);
        if (!isNaN(numVal) && numVal >= min && numVal <= max) {
          indices.push(...rowIndices);
        }
      }
      fieldResults.push(indices);
    } else if (Array.isArray(range)) {
      const indices: number[] = [];
      for (const val of range) {
        const key = String(val);
        const rowIndices = fieldMap[key];
        if (rowIndices) indices.push(...rowIndices);
      }
      fieldResults.push(indices);
    }
  }

  if (fieldResults.length === 0) return [];
  if (fieldResults.length === 1) return fieldResults[0]!;

  let intersection = new Set(fieldResults[0]!);
  for (let i = 1; i < fieldResults.length; i++) {
    const next = new Set(fieldResults[i]!);
    intersection = new Set([...intersection].filter((x) => next.has(x)));
  }
  return [...intersection];
}
