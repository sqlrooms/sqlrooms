import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {useMemo} from 'react';
import {useCellsStore} from './hooks';
import type {Cell, SqlCellData} from './types';
import {getEffectiveResultName, isValidSqlIdentifier} from './utils';

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
 * 1. Basic validation (empty, valid SQL identifier)
 * 2. Not already used by another SQL cell in the same sheet (name collision).
 * 3. Not conflicting with a main-schema table name (would shadow real data).
 * 4. Not creating a self-reference cycle (SQL references the proposed name).
 */
export function validateResultName(opts: {
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

  const trimmedName = proposedName.trim();

  // 1. Basic validation first
  if (!trimmedName) {
    return 'Cannot be empty';
  }

  if (!isValidSqlIdentifier(trimmedName)) {
    return 'Must be a valid SQL identifier';
  }

  const nameLower = trimmedName.toLowerCase();

  // 2. Check for name collision with other SQL cells in the same sheet
  for (const cellId of sheetCellIds) {
    if (cellId === currentCellId) {
      continue;
    }

    const cell = cells[cellId];
    if (!cell || cell.type !== 'sql') {
      continue;
    }

    const otherName = getEffectiveResultName(
      cell.data as SqlCellData,
      convertToValidName,
    );

    if (otherName.toLowerCase() === nameLower) {
      return 'Already used by another cell';
    }
  }

  // 3. Check for conflict with main-schema table names
  if (mainSchemaTableNames.some((t) => t.toLowerCase() === nameLower)) {
    return 'Conflicts with existing table';
  }

  // 4. Check for self-reference cycle: the cell's SQL references the proposed name
  if (containsIdentifier(currentCellSql, trimmedName)) {
    return 'Name creates a dependency cycle';
  }

  return null;
}

/**
 * Hook to validate SQL cell result names.
 * Returns an error message if invalid, or null if valid.
 *
 * Performs all validation checks via validateResultName:
 * 1. Basic validation (empty, valid SQL identifier)
 * 2. Name collision with other cells
 * 3. Conflict with main-schema tables
 * 4. Self-reference cycle detection
 */
export function useValidateResultName(
  cellId: string,
  name: string,
): string | null {
  const artifactId = useCellsStore((s) => s.cells.getArtifactIdForCell(cellId));
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const artifacts = useCellsStore((s) => s.cells.config.artifacts);
  const tableSchemas = useCellsStore((s) => s.db.tables);

  const currentCell = cellsData[cellId];
  const currentCellSql =
    currentCell?.type === 'sql' ? currentCell.data.sql : '';

  const artifactCellIds = useMemo(
    () => (artifactId ? (artifacts[artifactId]?.cellIds ?? []) : []),
    [artifactId, artifacts],
  );

  const mainSchemaTableNames = useMemo(
    () =>
      tableSchemas
        .filter((t) => (t.table.schema ?? t.schema) === 'main')
        .map((t) => t.table.table ?? t.tableName),
    [tableSchemas],
  );

  return useMemo(() => {
    return validateResultName({
      proposedName: name,
      currentCellId: cellId,
      currentCellSql,
      sheetCellIds: artifactCellIds,
      cells: cellsData,
      mainSchemaTableNames,
      convertToValidName: convertToValidColumnOrTableName,
    });
  }, [
    name,
    cellId,
    currentCellSql,
    artifactCellIds,
    cellsData,
    mainSchemaTableNames,
  ]);
}
