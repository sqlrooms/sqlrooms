import type {
  Cell,
  CellRegistryItem,
  CellsRootState,
  CellStatus,
  SqlCellStatus,
} from '@sqlrooms/cells';
import {
  findArtifactIdForCell,
  resolveArtifactSchemaName,
} from '@sqlrooms/cells';
import {produce} from 'immer';
import {PivotCellContent} from './PivotCellContent';
import {isPivotCell, type PivotCell} from './pivotCellTypes';
import {createPivotQuerySource} from './sql';
import type {PivotQuerySource, PivotSliceState, PivotStatus} from './types';

type PivotRootState = CellsRootState & PivotSliceState;

function pivotStatusToCellStatus(pivotStatus: PivotStatus): CellStatus {
  const statusMap: Record<string, string> = {
    idle: 'idle',
    running: 'running',
    success: 'success',
    error: 'error',
  };
  return {
    type: 'pivot',
    status: statusMap[pivotStatus.state] ?? 'idle',
    stale: pivotStatus.stale,
    lastError: pivotStatus.lastError,
    lastRunTime: pivotStatus.lastRunTime,
  };
}

function resolveSqlQuerySource(
  state: CellsRootState,
  sqlId: string,
): PivotQuerySource | undefined {
  const sourceStatus = state.cells.status[sqlId];
  const resultView =
    sourceStatus?.type === 'sql'
      ? (sourceStatus as SqlCellStatus).resultView
      : undefined;
  if (!resultView) return undefined;

  const sourceResult = state.cells.getCellResult(sqlId)?.arrowTable;
  const columns = sourceResult?.schema.fields.map((field) => ({
    name: field.name,
    type: String(field.type),
  }));
  if (!columns?.length) return undefined;

  return createPivotQuerySource(resultView, columns);
}

export const pivotCellRegistryEntry: CellRegistryItem<PivotCell> = {
  type: 'pivot',
  title: 'Pivot Table',

  createCell: ({id, get}) => {
    const state = get() as PivotRootState;
    const pivotId = state.pivot.addPivot({title: 'Pivot'});
    return {
      id,
      type: 'pivot',
      data: {pivotId},
    };
  },

  renderCell: ({id, cell, renderContainer}) => (
    <PivotCellContent
      id={id}
      cell={cell as PivotCell}
      renderContainer={renderContainer}
    />
  ),

  findDependencies: async () => {
    // We can't access PivotSlice from here (only cell data + cells map).
    // Pivot source info lives in PivotSlice, not in cell data.
    // TODO: if dependency tracking is needed, extend findDependencies args
    // to include the full store, or store the source kind in cell data.
    return [];
  },

  createStatus: (): CellStatus => ({
    type: 'pivot',
    status: 'idle',
    stale: true,
  }),

  onInitialize: () => {
    // PivotSlice.initialize() handles runtime resets.
  },

  onRemove: async ({id, get}) => {
    const state = get() as PivotRootState;
    const cell = state.cells.config.data[id];
    if (!cell || !isPivotCell(cell)) return;
    state.pivot.removePivot(cell.data.pivotId);
  },

  hasSemanticChange: (oldCell: Cell, newCell: Cell): boolean => {
    if (!isPivotCell(oldCell) || !isPivotCell(newCell)) return false;
    return oldCell.data.pivotId !== newCell.data.pivotId;
  },

  invalidateStatus: (currentStatus): CellStatus => ({
    type: 'pivot',
    status: 'idle',
    stale: true,
    lastRunTime: (currentStatus as {lastRunTime?: number}).lastRunTime,
  }),

  getRelationsToDrop: (): string[] => {
    // PivotSlice.removePivot() handles relation cleanup
    return [];
  },

  recordError: (currentStatus, message): CellStatus => ({
    ...currentStatus,
    status: 'error',
    stale: true,
    lastError: message,
  }),

  runCell: async ({id, opts, get, set}) => {
    const state = get() as PivotRootState;
    const cell = state.cells.config.data[id];
    if (!cell || !isPivotCell(cell)) return;

    const pivotId = cell.data.pivotId;
    const pivot = state.pivot.config.pivots[pivotId];
    if (!pivot) return;

    const artifactId = findArtifactIdForCell(state, id);
    const artifact = artifactId
      ? state.cells.config.artifacts[artifactId]
      : undefined;
    const schemaName = artifact
      ? resolveArtifactSchemaName(artifact)
      : opts?.schemaName || '__sqlrooms_pivot';

    let querySource: PivotQuerySource | undefined;
    if (pivot.source?.kind === 'sql') {
      querySource = resolveSqlQuerySource(state, pivot.source.sqlId);
      if (!querySource) {
        set((s) =>
          produce(s, (draft) => {
            draft.cells.status[id] = {
              type: 'pivot',
              status: 'error',
              stale: true,
              lastError: 'Pivot source SQL cell has no results. Run it first.',
            };
          }),
        );
        return;
      }
    }

    await state.pivot.runPivot(pivotId, {
      cascade: opts?.cascade,
      schemaName,
      querySource,
    });

    const updatedState = get() as PivotRootState;
    const updatedPivot = updatedState.pivot.config.pivots[pivotId];
    if (updatedPivot) {
      set((s) =>
        produce(s, (draft) => {
          draft.cells.status[id] = pivotStatusToCellStatus(updatedPivot.status);
        }),
      );
    }
  },
};
