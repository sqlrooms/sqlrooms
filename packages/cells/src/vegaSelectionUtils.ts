import type {CrossFilterSelection} from './types';

/**
 * The standard Vega param name used for brush selections
 * in cross-filter-enabled charts.
 */
export const BRUSH_PARAM_NAME = 'brush';

/**
 * Escapes a field name for use in SQL by wrapping in double quotes
 * and escaping embedded double quotes.
 */
function escapeFieldName(field: string): string {
  return `"${field.replace(/"/g, '""')}"`;
}

/**
 * Escapes a string value for use in SQL by escaping single quotes.
 */
function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Formats a value for use in SQL (numbers as-is, strings quoted and escaped).
 */
function formatSqlValue(value: unknown): string {
  if (typeof value === 'number') {
    return String(value);
  }
  return `'${escapeSqlString(String(value))}'`;
}

/**
 * Builds a SQL BETWEEN clause for interval selections.
 * Returns null if the range is invalid.
 */
function buildIntervalClause(
  quotedField: string,
  selection: CrossFilterSelection,
): string | null {
  const range = selection.value;
  if (!Array.isArray(range) || range.length !== 2) {
    return null;
  }

  const [lo, hi] = range;

  if (typeof lo === 'number' && typeof hi === 'number') {
    if (selection.fieldType === 'temporal') {
      return `${quotedField} BETWEEN epoch_ms(${Math.round(lo)}) AND epoch_ms(${Math.round(hi)})`;
    }
    return `${quotedField} BETWEEN ${lo} AND ${hi}`;
  }

  if (typeof lo === 'string' && typeof hi === 'string') {
    const loEsc = escapeSqlString(lo);
    const hiEsc = escapeSqlString(hi);
    return `${quotedField} BETWEEN '${loEsc}' AND '${hiEsc}'`;
  }

  return null;
}

/**
 * Builds a SQL IN clause for point selections.
 * Returns null if the values array is empty or invalid.
 */
function buildPointClause(
  quotedField: string,
  selection: CrossFilterSelection,
): string | null {
  const values = selection.value;
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const commaSeparated = values.map(formatSqlValue).join(', ');

  return `${quotedField} IN (${commaSeparated})`;
}

/**
 * Builds a SQL clause for a single selection based on its type.
 * Returns null if the selection type is unknown or the clause cannot be built.
 */
function buildClause(
  quotedField: string,
  selection: CrossFilterSelection,
): string | null {
  switch (selection.type) {
    case 'interval':
      return buildIntervalClause(quotedField, selection);
    case 'point':
      return buildPointClause(quotedField, selection);
    default:
      return null;
  }
}

/**
 * Build a SQL WHERE clause fragment from an array of sibling cross-filter
 * selections. Returns `null` when there are no active selections.
 *
 * Supports interval selections (BETWEEN) and point selections (IN).
 */
export function buildCrossFilterPredicate(
  selections: Array<CrossFilterSelection | null | undefined>,
): string | null {
  const clauses: string[] = [];

  for (const selection of selections) {
    if (!selection || selection.value == null) {
      continue;
    }

    const quotedField = escapeFieldName(selection.field);
    const clause = buildClause(quotedField, selection);

    if (clause) {
      clauses.push(clause);
    }
  }

  return clauses.length > 0 ? clauses.join(' AND ') : null;
}
