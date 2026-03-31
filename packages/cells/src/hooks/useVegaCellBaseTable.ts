import {useCellsStore} from '../hooks';
import {isSqlCellStatus} from '../types';
import type {VegaCell} from '../types';

/**
 * Resolves the base table for a Vega cell's data source.
 * Handles two data source types:
 * 1. Direct table reference (tableRef)
 * 2. Result view from another SQL cell (sqlId with resultView)
 */
export function useVegaCellBaseTable(cell: VegaCell): string | null {
  const selectedSqlId = cell.data.sqlId;
  const selectedTableRef = cell.data.tableRef;

  // Only subscribe to the status to get resultView
  const selectedSqlStatus = useCellsStore((s) =>
    selectedSqlId ? s.cells.status[selectedSqlId] : undefined,
  );

  const selectedResultView = isSqlCellStatus(selectedSqlStatus)
    ? selectedSqlStatus.resultView
    : undefined;

  return selectedTableRef || selectedResultView || null;
}
