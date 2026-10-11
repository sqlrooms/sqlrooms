import type {CSSProperties} from 'react';
import type {DataTableExplorerColumnState} from './types';

export const DATA_TABLE_EXPLORER_ROW_NUMBER_COLUMN_WIDTH_PX = 40;
export const DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_PX = 140;
export const DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_PX = 104;

function getWidthStyle(
  widthPx: number,
): Pick<CSSProperties, 'maxWidth' | 'minWidth' | 'width'> {
  return {
    maxWidth: widthPx,
    minWidth: widthPx,
    width: widthPx,
  };
}

export const DATA_TABLE_EXPLORER_ROW_NUMBER_WIDTH_STYLE = getWidthStyle(
  DATA_TABLE_EXPLORER_ROW_NUMBER_COLUMN_WIDTH_PX,
);
export const DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_STYLE = getWidthStyle(
  DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_PX,
);
export const DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_STYLE = getWidthStyle(
  DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_PX,
);

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
