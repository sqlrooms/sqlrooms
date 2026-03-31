import {useCellsStore} from '../hooks';
import {isSqlCellStatus} from '../types';
import type {VegaCell} from '../types';

/**
 * Returns the version (lastRunTime) of the SQL cell that this Vega cell depends on.
 * Used to trigger re-renders when the source SQL cell runs.
 */
export function useVegaCellVersion(cell: VegaCell): number | undefined {
  const selectedSqlId = cell.data.sqlId;

  // Subscribe to the full status for additional metadata
  const selectedSqlStatus = useCellsStore((s) =>
    selectedSqlId ? s.cells.status[selectedSqlId] : undefined,
  );

  return isSqlCellStatus(selectedSqlStatus)
    ? selectedSqlStatus.lastRunTime
    : undefined;
}
