import {arrowTableToJson, DuckDbConnector} from '@sqlrooms/duckdb';
import type {BrushFieldMapping} from './VegaChartTool';
import type {VegaBrushSelectionRanges} from './VegaLiteArrowChart';

// ---------------------------------------------------------------------------
// SQL parsing helpers
// ---------------------------------------------------------------------------

const AGGREGATE_PATTERN =
  /^(?:COUNT|SUM|AVG|MIN|MAX|STDDEV|VARIANCE|MEDIAN|APPROX_COUNT_DISTINCT|LIST|ARRAY_AGG|STRING_AGG|GROUP_CONCAT|FIRST|LAST|ANY_VALUE)\s*\(/i;

/**
 * Extract the first table name referenced in a SQL query.
 * Handles `FROM table`, `FROM "quoted"`, and `FROM schema.table`.
 */
export function extractTableNameFromSql(sql: string): string | null {
  const match = sql.match(/\bFROM\s+(?:"([^"]+)"|`([^`]+)`|(\w+(?:\.\w+)?))/i);
  if (!match) return null;
  const raw = match[1] ?? match[2] ?? match[3] ?? null;
  if (!raw) return null;
  const parts = raw.split('.');
  return parts[parts.length - 1] ?? null;
}

/**
 * Extract the body between `SELECT` and the top-level `FROM`, respecting
 * nesting of parenthesized subqueries and CASE expressions.
 */
function extractTopLevelSelectBody(sql: string): string | null {
  const upper = sql.toUpperCase();
  const selectIdx = upper.search(/\bSELECT\b/);
  if (selectIdx < 0) return null;

  let start = selectIdx + 'SELECT'.length;
  if (upper.substring(start).match(/^\s+DISTINCT\b/i)) {
    start += upper.substring(start).indexOf('DISTINCT') + 'DISTINCT'.length;
  }

  let depth = 0;
  let caseDepth = 0;
  for (let i = start; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === ']') {
      depth--;
    } else if (depth === 0) {
      const remaining = upper.substring(i);
      if (remaining.startsWith('CASE') && /^CASE\b/.test(remaining)) {
        caseDepth++;
      } else if (remaining.startsWith('END') && /^END\b/.test(remaining)) {
        caseDepth = Math.max(0, caseDepth - 1);
      } else if (
        caseDepth === 0 &&
        remaining.startsWith('FROM') &&
        /^FROM\b/.test(remaining)
      ) {
        return sql.substring(start, i);
      }
    }
  }
  return null;
}

/**
 * Split a SELECT clause into individual items, respecting nested parens
 * and function calls.
 */
function splitSelectItems(selectBody: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectBody) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) items.push(current);
  return items;
}

/**
 * Extract alias -> expression mappings from a SQL SELECT clause.
 * Returns only non-aggregate expressions (skips COUNT, SUM, etc.).
 *
 * Handles three forms:
 *   - `expr AS alias`        → alias maps to expr
 *   - `column_name`          → column_name maps to itself
 *   - `table.column_name`    → column_name maps to itself (qualified)
 *   - `*` or aggregates      → skipped
 */
function parseNonAggregateAliases(sql: string): Map<string, string> {
  const result = new Map<string, string>();
  const selectBody = extractTopLevelSelectBody(sql);
  if (!selectBody) return result;

  for (const item of splitSelectItems(selectBody)) {
    const trimmed = item.trim();
    if (trimmed === '*') continue;

    const asMatch = trimmed.match(/^([\s\S]+?)\s+AS\s+(\w+)\s*$/i);
    if (asMatch) {
      const expr = asMatch[1]!.trim();
      const alias = asMatch[2]!;
      if (AGGREGATE_PATTERN.test(expr)) continue;
      result.set(alias, expr);
      continue;
    }

    // Bare column: `col` or `table.col` or `"quoted_col"`
    const bareMatch = trimmed.match(/^(?:\w+\.)?(?:"([^"]+)"|(\w+))$/);
    if (bareMatch) {
      const colName = bareMatch[1] ?? bareMatch[2]!;
      result.set(colName, trimmed);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lazy brush mapping computation
// ---------------------------------------------------------------------------

const MAX_BRUSH_MAPPING_ROWS = 100_000;

/**
 * Computes a {@link BrushFieldMapping} for the given chart SQL by querying
 * the source table. Evaluates non-aggregate field expressions against every
 * row and groups source row indices by each expression's value.
 *
 * Returns `null` when the source table exceeds
 * {@link MAX_BRUSH_MAPPING_ROWS} rows to avoid expensive scans.
 */
export async function computeBrushMapping(
  connector: DuckDbConnector,
  chartSql: string,
): Promise<BrushFieldMapping | null> {
  const tableName = extractTableNameFromSql(chartSql);
  if (!tableName) return null;

  const aliasToExpr = parseNonAggregateAliases(chartSql);
  if (aliasToExpr.size === 0) return null;

  const escapedTable = `"${tableName.replace(/"/g, '""')}"`;

  const countResult = await connector.query(
    `SELECT COUNT(*) AS cnt FROM ${escapedTable}`,
  );
  const rowCount = Number(countResult?.getChildAt(0)?.get(0) ?? 0);
  if (rowCount > MAX_BRUSH_MAPPING_ROWS) return null;

  const selectParts = [`row_number() OVER () - 1 AS __row_idx`];
  const aliases: string[] = [];
  for (const [alias, expr] of aliasToExpr) {
    const escapedAlias = `"${alias.replace(/"/g, '""')}"`;
    selectParts.push(`(${expr}) AS ${escapedAlias}`);
    aliases.push(alias);
  }

  const sql = `SELECT ${selectParts.join(', ')} FROM ${escapedTable}`;
  const result = await connector.query(sql);
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
