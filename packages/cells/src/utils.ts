import {getArrowColumnTypeCategory} from '@sqlrooms/db';
import * as arrow from 'apache-arrow';
import type {BrushFieldType, SqlCellData} from './types';

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Type alias for schema sources used in field type detection.
 */
export type SchemaSource = arrow.Table | {schema: {fields: arrow.Field[]}};

/**
 * Detects the BrushFieldType for a given field in an Arrow table or schema.
 * Returns null for types that don't support cross-filtering (binary, json, struct, geometry).
 */
export function detectFieldType(
  fieldName: string,
  source: SchemaSource | undefined,
): BrushFieldType {
  const fields =
    source && 'schema' in source ? source.schema?.fields : undefined;

  const arrowField = fields?.find((field) => field.name === fieldName);

  if (!arrowField) {
    return null;
  }

  const category = getArrowColumnTypeCategory(arrowField.type);

  switch (category) {
    case 'datetime':
      return 'temporal';
    case 'string':
      return 'string';
    case 'number':
      return 'numeric';
    case 'boolean':
      return 'boolean';
    // Unsupported types for cross-filtering: binary, json, struct, geometry
    default:
      return null;
  }
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
