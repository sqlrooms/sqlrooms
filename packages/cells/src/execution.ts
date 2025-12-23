import type {CellsRootState} from './cellsSlice';
import {renderSqlWithInputs, findSqlDependencies} from './sqlHelpers';
import {escapeId, makeQualifiedTableName} from '@sqlrooms/duckdb';
import {produce} from 'immer';
import type {Cell, SqlCellStatus} from './types';
import {findSheetIdForCell} from './cellsSlice';

export type ExecuteSqlCellOptions = {
  schemaName: string;
  cascade?: boolean;
  signal?: AbortSignal;
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

  const {schemaName, cascade = true, signal} = options;
  const sqlRaw = (cell.data as any).sql || '';

  // 1. Gather inputs for SQL rendering
  const inputs = Object.values(state.cells.config.data)
    .filter((c) => c.type === 'input')
    .map((c) => ({
      varName: (c.data as any).input.varName as string,
      value: (c.data as any).input.value as string | number,
    }));

  const sql = renderSqlWithInputs(sqlRaw, inputs);

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
    const sheetId = findSheetIdForCell(state, cellId);
    const sheet = sheetId ? state.cells.config.sheets[sheetId] : undefined;
    const finalSchemaName = sheet?.title || schemaName;

    await connector.query(
      `CREATE SCHEMA IF NOT EXISTS ${escapeId(finalSchemaName)}`,
    );

    const tableName = makeQualifiedTableName({
      table: (cell.data as any).title as string,
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
      cells: state.cells.config.data,
      getSqlText: (c) => (c.type === 'sql' ? (c.data as any).sql : undefined),
      getInputVarName: (c) =>
        c.type === 'input' ? (c.data as any).input.varName : undefined,
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

    // 4. Cascade if needed
    if (cascade) {
      const currentSheetId = state.cells.config.currentSheetId;
      if (currentSheetId) {
        await state.cells.runDownstreamCascade(currentSheetId, cellId);
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
