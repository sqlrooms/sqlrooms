import {
  Cell,
  CellRegistry,
  CellsRootState,
  Sheet,
  SheetType,
  SqlSelectToJsonFn,
} from './types';
import {getSheetSchemaName} from './utils';

/**
 * Helper to resolve dependencies using async method if available, falling back to sync.
 */
export async function resolveDependencies(
  cell: Cell,
  cells: Record<string, Cell>,
  sheetId: string,
  registry: CellRegistry,
  sqlSelectToJson?: SqlSelectToJsonFn,
): Promise<string[]> {
  const item = registry[cell.type];
  if (!item) return [];

  if (item.findDependenciesAsync && sqlSelectToJson) {
    return item.findDependenciesAsync({cell, cells, sheetId, sqlSelectToJson});
  }
  return item.findDependencies({cell, cells, sheetId});
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
): Record<string, import('./types').Sheet> {
  const sheets: Record<string, import('./types').Sheet> = {};
  for (const [id, sheet] of Object.entries(state.cells.config.sheets)) {
    if (sheet.type === type) {
      sheets[id] = sheet;
    }
  }
  return sheets;
}

/**
 * Accessor used by cells internals to avoid repeating unsafe casts.
 */
export function getSqlSelectToJson(
  state: CellsRootState,
): SqlSelectToJsonFn | undefined {
  return state.db?.sqlSelectToJson;
}

/**
 * Resolves the schema name for a sheet, falling back to a stable id-based name.
 */
export function resolveSheetSchemaName(
  sheet: Pick<Sheet, 'id' | 'schemaName'>,
) {
  return sheet.schemaName || getSheetSchemaName(sheet.id);
}
