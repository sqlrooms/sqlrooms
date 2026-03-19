import {
  convertToValidColumnOrTableName,
  generateUniqueName,
} from '@sqlrooms/utils';
import type {Draft} from 'immer';
import type {CellsSliceConfig, SqlCellData} from './types';
import {getEffectiveResultName} from './utils';

/**
 * Migrates SQL cells without result names by assigning unique names per sheet.
 * Modifies the draft in place.
 */
export function migrateSqlCellResultNames(
  draft: Draft<{cells: {config: CellsSliceConfig}}>,
): void {
  const {config} = draft.cells;
  const {data, sheets} = config;

  if (!data || Object.keys(data).length === 0) {
    return;
  }

  Object.values(sheets).forEach((sheet) => {
    if (!sheet) {
      return;
    }

    // Collect existing result names in this sheet (only explicit ones)
    const existingNames = sheet.cellIds
      .map((cellId) => data[cellId])
      .map((cell) =>
        cell?.type === 'sql' ? (cell.data.resultName as string) : undefined,
      )
      .filter((name): name is string => Boolean(name));

    // Assign names to cells without them in this sheet
    sheet.cellIds.forEach((cellId) => {
      const cell = data[cellId];
      if (cell?.type === 'sql' && !cell.data.resultName) {
        // Use getEffectiveResultName to compute what the name would be
        const baseName = getEffectiveResultName(
          cell.data as SqlCellData,
          convertToValidColumnOrTableName,
        );

        const uniqueName = generateUniqueName(baseName, existingNames);

        cell.data.resultName = uniqueName;
        existingNames.push(uniqueName);
      }
    });
  });
}
