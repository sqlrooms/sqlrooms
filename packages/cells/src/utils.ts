import type {Cell, SqlCellData} from './types';

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Validates that a string is a valid SQL identifier.
 * Must start with a letter or underscore, followed by letters, digits, or underscores.
 */
export function isValidSqlIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Gets the effective result name for a SQL cell.
 * Returns explicit resultName if valid, otherwise auto-generates from title.
 */
export function getEffectiveResultName(
  data: SqlCellData,
  convertToValidName: (name: string) => string,
): string {
  if (data.resultName && isValidSqlIdentifier(data.resultName)) {
    return data.resultName;
  }

  const normalizedTitle = convertToValidName(data.title).toLowerCase();

  // Keep SQL default titles mapped to a neutral result_* name:
  // "SQL 1" -> "result_1", "SQL Query 2" -> "result_2".
  const sqlDefaultMatch = normalizedTitle.match(/^sql(?:_query)?(?:_(\d+))?$/);
  if (sqlDefaultMatch) {
    return sqlDefaultMatch[1] ? `result_${sqlDefaultMatch[1]}` : 'result';
  }

  return normalizedTitle;
}

/**
 * Generates a stable SQL schema name for a sheet id.
 */
export function getSheetSchemaName(sheetId: string): string {
  const normalized = sheetId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return `sheet_${normalized}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips single-quoted SQL string literals from text so that identifier
 * checks don't produce false positives on quoted string content.
 * Handles escaped single-quotes inside literals (e.g. 'it''s fine').
 */
function stripStringLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

function containsIdentifier(text: string, name: string): boolean {
  // The lookbehind includes '.' so that qualified names like `schema.my_result`
  // are NOT matched — we only want to detect unqualified references.
  // The lookahead intentionally omits '.' so that column-access expressions like
  // `my_result.column` ARE matched (they reference the `my_result` table).
  const pattern = new RegExp(
    `(?<![a-zA-Z0-9_.])${escapeRegExp(name)}(?![a-zA-Z0-9_])`,
    'i',
  );
  return pattern.test(stripStringLiterals(text));
}

/**
 * Validates whether a proposed result name is available for a SQL cell.
 *
 * Returns a human-readable error message if the name is taken or would cause
 * problems, or `null` if the name is acceptable.
 *
 * Checks performed (in order):
 * 1. Not already used by another SQL cell in the same sheet (name collision).
 * 2. Not conflicting with a main-schema table name (would shadow real data).
 * 3. Not creating a self-reference cycle (SQL references the proposed name).
 */
export function getResultNameValidationError(opts: {
  proposedName: string;
  currentCellId: string;
  currentCellSql: string;
  sheetCellIds: string[];
  cells: Record<string, Cell>;
  mainSchemaTableNames: ReadonlyArray<string>;
  convertToValidName: (name: string) => string;
}): string | null {
  const {
    proposedName,
    currentCellId,
    currentCellSql,
    sheetCellIds,
    cells,
    mainSchemaTableNames,
    convertToValidName,
  } = opts;

  const nameLower = proposedName.toLowerCase();

  // 1. Check for name collision with other SQL cells in the same sheet
  for (const cellId of sheetCellIds) {
    if (cellId === currentCellId) continue;
    const cell = cells[cellId];
    if (!cell || cell.type !== 'sql') continue;
    const otherName = getEffectiveResultName(
      cell.data as SqlCellData,
      convertToValidName,
    );
    if (otherName.toLowerCase() === nameLower) {
      return 'Name already used by another cell';
    }
  }

  // 2. Check for conflict with main-schema table names
  if (mainSchemaTableNames.some((t) => t.toLowerCase() === nameLower)) {
    return 'Name conflicts with an existing table';
  }

  // 3. Check for self-reference cycle: the cell's SQL references the proposed name
  if (containsIdentifier(currentCellSql, proposedName)) {
    return 'Name creates a dependency cycle';
  }

  return null;
}

/**
 * Extracts a preview from SQL query - first non-empty line and whether there are more lines.
 * Returns empty firstLine if the SQL is empty or contains only whitespace.
 */
export function getSqlQueryPreview(sql: string): {
  firstLine: string;
  hasMoreLines: boolean;
} {
  const [firstLine, ...rest] = sql
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (!firstLine) {
    return {firstLine: '', hasMoreLines: false};
  }

  return {
    firstLine,
    hasMoreLines: rest.length > 0,
  };
}
