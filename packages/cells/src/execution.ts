import {escapeId, makeQualifiedTableName} from '@sqlrooms/duckdb';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {produce} from 'immer';
import type {CellsRootState} from './cellsSlice';
import {findSheetIdForCell, resolveSheetSchemaName} from './helpers';
import {
  findSqlDependencies,
  qualifySheetLocalResultNames,
  renderSqlWithInputs,
} from './sqlHelpers';
import {
  isInputCell,
  isSqlCell,
  type CellResultData,
  type SqlCellData,
  type SqlCellStatus,
} from './types';
import {getEffectiveResultName} from './utils';

const DEFAULT_PAGE_SIZE = 10;

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export type ExecuteSqlCellOptions = {
  schemaName: string;
  cascade?: boolean;
  signal?: AbortSignal;
  setCellResult?: (id: string, data: CellResultData) => void;
};

export async function executeSqlCell(
  cellId: string,
  getState: () => CellsRootState,
  set: (updater: (state: CellsRootState) => CellsRootState) => void,
  options: ExecuteSqlCellOptions,
) {
  const state = getState();
  const cell = state.cells.config.data[cellId];
  if (!cell || cell.type !== 'sql') return;

  const {schemaName, cascade = true, signal, setCellResult} = options;
  const sqlRaw = cell.data.sql || '';
  const sheetId = findSheetIdForCell(state, cellId);
  const sheet = sheetId ? state.cells.config.sheets[sheetId] : undefined;
  const finalSchemaName = sheet ? resolveSheetSchemaName(sheet) : schemaName;
  const sheetCellIds = sheet?.cellIds ?? [];

  // 1. Gather inputs for SQL rendering
  const cellsInScope = (
    sheetCellIds.length ? sheetCellIds : Object.keys(state.cells.config.data)
  )
    .map((id) => state.cells.config.data[id])
    .filter(isDefined);
  const inputs = cellsInScope
    .filter((c) => isInputCell(c))
    .map((c) => ({
      varName: c.data.input.varName,
      value: c.data.input.value,
    }));

  const renderedSql = renderSqlWithInputs(sqlRaw, inputs);
  const sql = qualifySheetLocalResultNames({
    sql: renderedSql,
    sheetSchema: finalSchemaName,
    sheetCellIds,
    cells: state.cells.config.data,
    getSqlResultName: (id) => {
      const target = state.cells.config.data[id];
      if (!target || target.type !== 'sql') return undefined;
      return getEffectiveResultName(
        target.data as SqlCellData,
        convertToValidColumnOrTableName,
      );
    },
  });

  // 2. Update status to running
  set((s) =>
    produce(s, (draft) => {
      draft.cells.status[cellId] = {
        type: 'sql',
        status: 'running',
        referencedTables:
          (draft.cells.status[cellId] as SqlCellStatus)?.referencedTables || [],
      };
    }),
  );

  try {
    const db = state.db;

    if (signal?.aborted) throw new Error('Query cancelled');

    const parsed = await db.sqlSelectToJson(sql);
    if (parsed.error) {
      throw new Error(parsed.error_message || 'Not a valid SELECT statement');
    }

    if (signal?.aborted) throw new Error('Query cancelled');

    const connector = await db.getConnector();
    await connector.query(
      `CREATE SCHEMA IF NOT EXISTS ${escapeId(finalSchemaName)}`,
    );

    const effectiveResultName = getEffectiveResultName(
      cell.data as SqlCellData,
      convertToValidColumnOrTableName,
    );
    const tableName = makeQualifiedTableName({
      table: effectiveResultName,
      schema: finalSchemaName,
      database: db.currentDatabase,
    }).toString();

    if (signal?.aborted) throw new Error('Query cancelled');

    await connector.query(`CREATE OR REPLACE VIEW ${tableName} AS ${sql}`, {
      signal,
    });

    if (signal?.aborted) throw new Error('Query cancelled');

    // Find dependencies for referenced tables
    const referenced = findSqlDependencies({
      targetCell: cell,
      cells: Object.fromEntries(cellsInScope.map((c) => [c.id, c])),
      getSqlText: (c) => (isSqlCell(c) ? c.data.sql : undefined),
      getInputVarName: (c) =>
        isInputCell(c) ? c.data.input.varName : undefined,
      getSqlResultName: (id) => {
        const s = getState().cells.status[id];
        return s?.type === 'sql' ? s.resultName : undefined;
      },
    });

    // 3. Update status to success
    set((s) =>
      produce(s, (draft) => {
        draft.cells.status[cellId] = {
          type: 'sql',
          status: 'success',
          resultName: tableName,
          resultView: tableName,
          referencedTables: referenced,
          lastRunTime: Date.now(),
        };
      }),
    );

    // 4. Fetch count + first page and store result
    if (setCellResult) {
      if (signal?.aborted) throw new Error('Query cancelled');

      const countResult = await connector.query(
        `SELECT COUNT(*)::int AS count FROM ${tableName}`,
      );
      const totalRows = countResult.toArray()[0]?.count ?? 0;

      if (signal?.aborted) throw new Error('Query cancelled');

      const pageResult = await connector.query(
        `SELECT * FROM ${tableName} LIMIT ${DEFAULT_PAGE_SIZE}`,
      );

      setCellResult(cellId, {arrowTable: pageResult, totalRows});
    }

    // 5. Cascade if needed
    if (cascade) {
      const ownerSheetId = findSheetIdForCell(getState(), cellId);
      if (ownerSheetId) {
        await state.cells.runDownstreamCascade(ownerSheetId, cellId);
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    set((s) =>
      produce(s, (draft) => {
        const status = draft.cells.status[cellId];
        if (status?.type === 'sql') {
          status.status = signal?.aborted ? 'cancel' : 'error';
          status.lastError = message;
        }
      }),
    );
  } finally {
    set((s) =>
      produce(s, (draft) => {
        delete draft.cells.activeAbortControllers[cellId];
      }),
    );
  }
}
