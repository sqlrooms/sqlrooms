import {
  createPivotQuerySource,
  createPivotQuerySourceFromTable,
  type PivotQuerySource,
} from '@sqlrooms/pivot';
import type {CellsRootState, PivotCell, SqlCellStatus} from './types';
import {isDefined} from './utils';

export function getPivotQuerySourceForCell(
  state: CellsRootState,
  cell: PivotCell,
): {
  querySource?: PivotQuerySource;
  sourceRelation?: string;
} {
  const source = cell.data.source;
  if (!source) {
    return {};
  }

  if (source.kind === 'table') {
    const table = state.db.tables.find(
      (candidate) => candidate.tableName === source.tableName,
    );
    if (!table) {
      return {};
    }
    return {
      querySource: createPivotQuerySourceFromTable(table),
      sourceRelation: table.table.toString(),
    };
  }

  const sourceStatus = state.cells.status[source.sqlId];
  const resultView =
    sourceStatus?.type === 'sql' ? sourceStatus.resultView : undefined;
  if (!resultView) {
    return {};
  }

  const sourceResult = state.cells.getCellResult(source.sqlId)?.arrowTable;
  const columns = sourceResult?.schema.fields.map((field) => ({
    name: field.name,
    type: String(field.type),
  }));
  if (!columns?.length) {
    return {
      sourceRelation: resultView,
    };
  }

  return {
    querySource: createPivotQuerySource(resultView, columns),
    sourceRelation: resultView,
  };
}

export function getPivotSqlSourceOptions(
  state: CellsRootState,
  sheetId?: string,
) {
  const sheetCellIds = sheetId
    ? (state.cells.config.sheets[sheetId]?.cellIds ?? [])
    : [];
  return sheetCellIds
    .map((cellId) => {
      const cell = state.cells.config.data[cellId];
      const status = state.cells.status[cellId];
      if (!cell || cell.type !== 'sql') {
        return undefined;
      }
      const sqlStatus =
        status?.type === 'sql' ? (status as SqlCellStatus) : undefined;
      return {
        id: cell.id,
        label:
          sqlStatus?.resultView ??
          cell.data.resultName ??
          cell.data.title ??
          cell.id,
        resultView: sqlStatus?.resultView,
      };
    })
    .filter(isDefined);
}
