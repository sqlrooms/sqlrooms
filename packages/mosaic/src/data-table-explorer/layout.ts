import type {DataTableExplorerColumnState} from './types';

export const DATA_TABLE_EXPLORER_ROW_NUMBER_COLUMN_WIDTH_PX = 40;
export const DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_PX = 140;
export const DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_PX = 104;

export const DATA_TABLE_EXPLORER_ROW_NUMBER_WIDTH_CLASS =
  'min-w-[40px] w-[40px] max-w-[40px]';
export const DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_CLASS =
  'min-w-[140px] w-[140px] max-w-[140px]';
export const DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_CLASS =
  'min-w-[104px] w-[104px] max-w-[104px]';

export function getDataTableExplorerColumnWidthPx(
  column: DataTableExplorerColumnState,
) {
  return column.kind === 'unsupported'
    ? DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_PX
    : DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_PX;
}

export function getDataTableExplorerTableWidth(
  columns: DataTableExplorerColumnState[],
) {
  return (
    DATA_TABLE_EXPLORER_ROW_NUMBER_COLUMN_WIDTH_PX +
    columns.reduce(
      (total, column) => total + getDataTableExplorerColumnWidthPx(column),
      0,
    )
  );
}
