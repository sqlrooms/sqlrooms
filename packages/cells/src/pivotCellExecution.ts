import {
  executePivotRelations,
  getPivotFieldsFromTable,
  sanitizePivotConfigForFields,
  type PivotField,
  type PivotSource,
} from '@sqlrooms/pivot-table';
import {produce} from 'immer';
import {
  findSheetIdForCell,
  getUnqualifiedSqlIdentifier,
  resolveSheetSchemaName,
} from './helpers';
import type {CellResultData, CellsRootState, PivotCellStatus} from './types';

export type ExecutePivotCellOptions = {
  schemaName: string;
  cascade?: boolean;
  signal?: AbortSignal;
  setCellResult?: (id: string, data: CellResultData) => void;
};

export function resolvePivotSourceInfo(
  state: CellsRootState,
  source: PivotSource | undefined,
): {
  sourceRelation?: string;
  fields: PivotField[];
  relationLabel?: string;
} {
  if (!source) {
    return {fields: []};
  }
  if (source.kind === 'table') {
    const table = state.db.tables.find(
      (candidate) => candidate.tableName === source.tableName,
    );
    return {
      sourceRelation: table?.table.toString(),
      fields: getPivotFieldsFromTable(table),
      relationLabel: source.tableName,
    };
  }
  const status = state.cells.status[source.sqlId];
  const sourceRelation =
    status?.type === 'sql' && status.resultView ? status.resultView : undefined;
  const tableName = getUnqualifiedSqlIdentifier(sourceRelation);
  const table = tableName
    ? state.db.tables.find((candidate) => candidate.tableName === tableName)
    : undefined;
  return {
    sourceRelation,
    fields: getPivotFieldsFromTable(table),
    relationLabel: tableName,
  };
}

export async function executePivotCell(
  cellId: string,
  getState: () => CellsRootState,
  set: (updater: (state: CellsRootState) => CellsRootState) => void,
  options: ExecutePivotCellOptions,
) {
  const state = getState();
  const cell = state.cells.config.data[cellId];
  if (!cell || cell.type !== 'pivot') return;
  const previousStatus =
    state.cells.status[cellId]?.type === 'pivot'
      ? state.cells.status[cellId]
      : undefined;
  const {schemaName, cascade = true, signal} = options;
  const sheetId = findSheetIdForCell(state, cellId);
  const sheet = sheetId ? state.cells.config.sheets[sheetId] : undefined;
  const finalSchemaName = sheet ? resolveSheetSchemaName(sheet) : schemaName;
  const sourceInfo = resolvePivotSourceInfo(state, cell.data.source);
  if (!sourceInfo.sourceRelation) {
    throw new Error('Select a source with an available result before running.');
  }
  const nextConfig = sanitizePivotConfigForFields(
    cell.data.pivotConfig,
    sourceInfo.fields,
  );

  set((draftState) =>
    produce(draftState, (draft) => {
      const draftCell = draft.cells.config.data[cellId];
      if (draftCell?.type === 'pivot') {
        draftCell.data.pivotConfig = nextConfig;
      }
      const status = draft.cells.status[cellId] as PivotCellStatus | undefined;
      draft.cells.status[cellId] = {
        type: 'pivot',
        status: 'running',
        stale: false,
        resultName: status?.resultName,
        resultView: status?.resultView,
        resultRelationType: status?.resultRelationType,
        relations: status?.relations,
        lastRunTime: status?.lastRunTime,
      };
    }),
  );

  try {
    const connector = await state.db.getConnector();
    const relations = await executePivotRelations({
      connector,
      schemaName: finalSchemaName,
      sourceRelation: sourceInfo.sourceRelation,
      config: nextConfig,
      relationId: cellId,
      database: state.db.currentDatabase,
      signal,
    });

    set((draftState) =>
      produce(draftState, (draft) => {
        draft.cells.status[cellId] = {
          type: 'pivot',
          status: 'success',
          stale: false,
          resultName: relations.cellsRelation,
          resultView: relations.cellsRelation,
          resultRelationType: relations.relationType,
          relations,
          lastRunTime: Date.now(),
        };
      }),
    );

    if (cascade && sheetId) {
      await state.cells.runDownstreamCascade(sheetId, cellId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    set((draftState) =>
      produce(draftState, (draft) => {
        draft.cells.status[cellId] = {
          ...(draft.cells.status[cellId]?.type === 'pivot'
            ? draft.cells.status[cellId]
            : {type: 'pivot', stale: true}),
          type: 'pivot',
          status: signal?.aborted ? 'cancel' : 'error',
          stale: true,
          lastError: message,
        };
      }),
    );
  } finally {
    set((draftState) =>
      produce(draftState, (draft) => {
        delete draft.cells.activeAbortControllers[cellId];
      }),
    );
  }
}
