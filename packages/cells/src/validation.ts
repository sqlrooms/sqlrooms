import {Cell, Sheet} from './types';

/**
 * Validates that a cell title is unique within its sheet.
 */
export function validateCellTitle(
  title: string,
  cellIds: string[],
  cells: Record<string, Cell>,
  excludeCellId?: string,
): {valid: boolean; error?: string} {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) {
    return {valid: false, error: 'Title cannot be empty'};
  }

  for (const id of cellIds) {
    if (id === excludeCellId) continue;
    const cell = cells[id];
    if (
      cell &&
      (cell.data as any).title?.trim().toLowerCase() === normalizedTitle
    ) {
      return {
        valid: false,
        error: `A cell named "${title}" already exists in this sheet`,
      };
    }
  }

  return {valid: true};
}

/**
 * Validates that a sheet title is unique.
 */
export function validateSheetTitle(
  title: string,
  sheets: Record<string, Sheet>,
  excludeSheetId?: string,
): {valid: boolean; error?: string} {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) {
    return {valid: false, error: 'Title cannot be empty'};
  }

  for (const sheet of Object.values(sheets)) {
    if (sheet.id === excludeSheetId) continue;
    if (sheet.title.trim().toLowerCase() === normalizedTitle) {
      return {valid: false, error: `A sheet named "${title}" already exists`};
    }
  }

  return {valid: true};
}
