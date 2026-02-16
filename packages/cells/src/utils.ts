import type {SqlCellData} from './types';

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
