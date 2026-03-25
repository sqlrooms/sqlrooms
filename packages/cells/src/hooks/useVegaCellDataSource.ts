import {useCellsStore} from '../hooks';
import {isSqlCell, isSqlCellStatus} from '../types';
import type {VegaCell, CellStatus} from '../types';

export type VegaCellDataSource = {
  selectedSqlId: string | undefined;
  selectedTableRef: string | undefined;
  selectedSqlStatus: CellStatus | undefined;
  baseSqlQuery: string;
  lastRunTime: number | undefined;
  hasDataSource: boolean;
};

/**
 * Resolves the data source for a Vega cell and builds the base SQL query.
 * Handles three data source types:
 * 1. Direct table reference (tableRef)
 * 2. Result view from another SQL cell (sqlId with resultView)
 * 3. Raw SQL from another cell (sqlId with sql)
 */
export function useVegaCellDataSource(cell: VegaCell): VegaCellDataSource {
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const cellsStatus = useCellsStore((s) => s.cells.status);

  const selectedSqlId = cell.data.sqlId;
  const selectedTableRef = cell.data.tableRef;

  const selectedSqlStatus = selectedSqlId
    ? cellsStatus[selectedSqlId]
    : undefined;

  const hasDataSource = !!(selectedSqlId || selectedTableRef);

  const selectedCell = selectedSqlId ? cellsData[selectedSqlId] : null;

  const selectedCellSql =
    selectedCell && isSqlCell(selectedCell) ? selectedCell.data.sql : '';

  const selectedResultView = isSqlCellStatus(selectedSqlStatus)
    ? selectedSqlStatus.resultView
    : undefined;

  const baseTable = selectedTableRef || selectedResultView;

  const baseSqlQuery = baseTable
    ? `SELECT * FROM ${baseTable}`
    : selectedCellSql;

  const lastRunTime = isSqlCellStatus(selectedSqlStatus)
    ? selectedSqlStatus.lastRunTime
    : undefined;

  return {
    selectedSqlId,
    selectedTableRef,
    selectedSqlStatus,
    baseSqlQuery,
    lastRunTime,
    hasDataSource,
  };
}
