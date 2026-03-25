import {
  Cell,
  CellDependencies,
  CellRegistry,
  CellsRootState,
  CellsSliceConfig,
  Sheet,
  SheetType,
  SqlSelectToJsonFn,
} from './types';
import {getSheetSchemaName} from './utils';

/**
 * Normalizes the result of `findDependencies` to a `CellDependencies` object.
 * Accepts either the legacy `string[]` (cell IDs only) or the new `CellDependencies` shape.
 */
export function normalizeCellDependencies(
  result: string[] | CellDependencies,
): CellDependencies {
  if (Array.isArray(result)) {
    return {cellIds: result};
  }
  return result;
}

/**
 * Helper to resolve dependencies using the registry's async AST-based resolver.
 */
export async function resolveDependencies(
  cell: Cell,
  cells: Record<string, Cell>,
  sheetId: string,
  registry: CellRegistry,
  sqlSelectToJson: SqlSelectToJsonFn,
): Promise<CellDependencies> {
  const item = registry[cell.type];
  if (!item) return {cellIds: []};
  const raw = await item.findDependencies({
    cell,
    cells,
    sheetId,
    sqlSelectToJson,
  });
  return normalizeCellDependencies(raw);
}

/**
 * Finds the sheet ID that contains the given cell ID.
 */
export function findSheetIdForCell(
  state: CellsRootState,
  cellId: string,
): string | undefined {
  for (const [id, sheet] of Object.entries(state.cells.config.sheets)) {
    if (sheet.cellIds.includes(cellId)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Gets all sheets of a specific type.
 */
export function getSheetsByType(
  state: CellsRootState,
  type: SheetType,
): Record<string, Sheet> {
  const sheets: Record<string, Sheet> = {};
  for (const [id, sheet] of Object.entries(state.cells.config.sheets)) {
    if (sheet.type === type) {
      sheets[id] = sheet;
    }
  }
  return sheets;
}

/**
 * Required accessor for SQL AST parser used in dependency derivation.
 */
export function getRequiredSqlSelectToJson(
  state: CellsRootState,
): SqlSelectToJsonFn {
  const parser = state.db?.sqlSelectToJson;
  if (!parser) {
    throw new Error(
      'cells dependency derivation requires db.sqlSelectToJson. Ensure the DuckDB slice is mounted and initialized before running cell dependency operations.',
    );
  }
  return parser;
}

/**
 * Normalizes structural sheet fields in a partial cells config.
 *
 * This enforces internal invariants before the config is applied:
 * - `sheets` always contains at least one entry (falls back to defaults).
 * - `sheetOrder` only contains existing sheet ids and includes every sheet.
 * - `currentSheetId` always points to an existing sheet.
 *
 * Non-structural fields are preserved by the caller when merging.
 */
export function normalizeCellsConfigStructure(
  config: Partial<CellsSliceConfig>,
  defaultConfig: CellsSliceConfig,
): Pick<CellsSliceConfig, 'sheets' | 'sheetOrder' | 'currentSheetId'> {
  const sheets =
    config.sheets && Object.keys(config.sheets).length > 0
      ? config.sheets
      : defaultConfig.sheets;
  const sheetIds = Object.keys(sheets);
  const normalizedSheetOrder =
    config.sheetOrder?.filter((id) => id in sheets) ?? [];
  const missingSheetIds = sheetIds.filter(
    (id) => !normalizedSheetOrder.includes(id),
  );
  const sheetOrder =
    normalizedSheetOrder.length > 0
      ? [...normalizedSheetOrder, ...missingSheetIds]
      : sheetIds;
  const currentSheetId =
    (config.currentSheetId && config.currentSheetId in sheets
      ? config.currentSheetId
      : sheetOrder[0]) ?? sheetIds[0];

  return {sheets, sheetOrder, currentSheetId};
}

/**
 * Returns the final identifier segment from a possibly-qualified SQL name.
 *
 * The parser is quote-aware: dots inside double-quoted identifiers are treated
 * as part of the identifier rather than as qualification separators.
 *
 * Examples:
 * - `schema.table` -> `table`
 * - `db.schema.table` -> `table`
 * - `schema."my.funny.table"` -> `my.funny.table`
 */
export function getUnqualifiedSqlIdentifier(
  qualifiedName: string | undefined,
): string | undefined {
  if (!qualifiedName) return undefined;
  const input = qualifiedName.trim();
  if (!input) return undefined;

  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      // In SQL identifiers, escaped quotes inside quoted identifiers are doubled.
      if (inQuotes && input[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (ch === '.' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }

    current += ch;
  }
  parts.push(current);

  const last = parts[parts.length - 1]?.trim();
  if (!last) return undefined;
  if (last.startsWith('"') && last.endsWith('"') && last.length >= 2) {
    return last.slice(1, -1).replaceAll('""', '"');
  }
  return last;
}

/**
 * Resolves the schema name for a sheet, falling back to a stable id-based name.
 */
export function resolveSheetSchemaName(
  sheet: Pick<Sheet, 'id' | 'schemaName'>,
) {
  return sheet.schemaName || getSheetSchemaName(sheet.id);
}
