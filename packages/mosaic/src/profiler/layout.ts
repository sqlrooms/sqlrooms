import type {MosaicProfilerColumnState} from './types';

export const PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX = 40;
export const PROFILER_DEFAULT_COLUMN_WIDTH_PX = 140;
export const PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX = 104;

export function getProfilerColumnWidthPx(column: MosaicProfilerColumnState) {
  return column.kind === 'unsupported'
    ? PROFILER_UNSUPPORTED_COLUMN_WIDTH_PX
    : PROFILER_DEFAULT_COLUMN_WIDTH_PX;
}

export function getProfilerTableWidth(columns: MosaicProfilerColumnState[]) {
  return (
    PROFILER_ROW_NUMBER_COLUMN_WIDTH_PX +
    columns.reduce(
      (total, column) => total + getProfilerColumnWidthPx(column),
      0,
    )
  );
}
