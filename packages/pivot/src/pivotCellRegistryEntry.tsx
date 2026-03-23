import type {Cell, CellRegistryItem, CellStatus} from '@sqlrooms/cells';
import {produce} from 'immer';
import {createDefaultPivotConfig, normalizePivotConfig} from './PivotCoreSlice';
import {createOrReplacePivotRelations} from './pivotExecution';
import {PivotCellContent} from './PivotCellContent';
import {
  isPivotCell,
  type PivotCell,
  type PivotCellStatus,
} from './pivotCellTypes';
import {getPivotQuerySourceForCell} from './pivotCellHelpers';
import {findSheetIdForCell, resolveSheetSchemaName} from '@sqlrooms/cells';
import {dropPivotRelations} from './pivotExecution';

function isDefined<T>(value: T | undefined | null): value is T {
  return value != null;
}

export const pivotCellRegistryEntry: CellRegistryItem<PivotCell> = {
  type: 'pivot',
  title: 'Pivot Table',
  createCell: (id: string): PivotCell => ({
    id,
    type: 'pivot',
    data: {
      title: 'Pivot',
      pivotConfig: createDefaultPivotConfig(),
    },
  }),
  renderCell: ({id, cell, renderContainer}) => (
    <PivotCellContent
      id={id}
      cell={cell as PivotCell}
      renderContainer={renderContainer}
    />
  ),
  findDependencies: async ({cell}) => {
    const source = (cell as PivotCell).data.source;
    return source?.kind === 'sql' ? [source.sqlId] : [];
  },
  createStatus: (): CellStatus => ({
    type: 'pivot',
    status: 'idle',
    stale: true,
  }),
  onInitialize: ({id, status, set}) => {
    if (status?.type !== 'pivot') return;
    const pivotStatus = status as PivotCellStatus;
    set((state) =>
      produce(state, (draft) => {
        draft.cells.status[id] = {
          type: 'pivot',
          status: 'idle',
          stale: true,
          lastRunTime: pivotStatus.lastRunTime,
          resultViews: undefined,
          sourceRelation: undefined,
        };
      }),
    );
  },
  onRemove: async ({status, get}) => {
    if (status?.type !== 'pivot') return;
    const pivotStatus = status as PivotCellStatus;
    if (!pivotStatus.resultViews) return;
    try {
      const connector = await get().db.getConnector();
      await dropPivotRelations({connector, relations: pivotStatus.resultViews});
    } catch {
      // best-effort
    }
  },
  hasSemanticChange: (oldCell: Cell, newCell: Cell): boolean => {
    if (!isPivotCell(oldCell) || !isPivotCell(newCell)) return false;
    return (
      JSON.stringify(oldCell.data.source) !==
        JSON.stringify(newCell.data.source) ||
      JSON.stringify(oldCell.data.pivotConfig) !==
        JSON.stringify(newCell.data.pivotConfig)
    );
  },
  invalidateStatus: (currentStatus): CellStatus => ({
    type: 'pivot',
    status: 'idle',
    stale: true,
    lastRunTime: (currentStatus as PivotCellStatus).lastRunTime,
  }),
  getRelationsToDrop: (status): string[] => {
    const pivotStatus = status as PivotCellStatus;
    return pivotStatus.resultViews
      ? Object.values(pivotStatus.resultViews).filter(isDefined)
      : [];
  },
  recordError: (currentStatus, message): CellStatus => ({
    ...currentStatus,
    status: 'error',
    stale: true,
    lastError: message,
  }),
  runCell: async ({id, opts, get, set}) => {
    const state = get();
    const cell = state.cells.config.data[id];
    if (!cell || cell.type !== 'pivot') {
      return;
    }

    const sheetId = findSheetIdForCell(state, id);
    const sheet = sheetId ? state.cells.config.sheets[sheetId] : undefined;
    const schemaName = sheet
      ? resolveSheetSchemaName(sheet)
      : opts?.schemaName || 'main';
    const controller = new AbortController();
    set((s) =>
      produce(s, (draft) => {
        draft.cells.activeAbortControllers[id] = controller;
        draft.cells.status[id] = {
          type: 'pivot',
          status: 'running',
          stale: true,
          resultViews:
            draft.cells.status[id]?.type === 'pivot'
              ? (draft.cells.status[id] as PivotCellStatus).resultViews
              : undefined,
        };
      }),
    );

    try {
      const runtime = getPivotQuerySourceForCell(get(), cell as PivotCell);
      if (!runtime.querySource || !runtime.sourceRelation) {
        throw new Error(
          'Pivot source is not ready. Run the source query first.',
        );
      }

      const connector = await state.db.getConnector();
      const normalizedConfig = normalizePivotConfig(
        (cell as PivotCell).data.pivotConfig,
        runtime.querySource.columns,
      );
      const resultViews = await createOrReplacePivotRelations({
        connector,
        source: runtime.querySource,
        config: normalizedConfig,
        relationBaseName: `pivot_${id}`,
        schemaName,
        signal: controller.signal,
      });

      set((s) =>
        produce(s, (draft) => {
          draft.cells.status[id] = {
            type: 'pivot',
            status: 'success',
            stale: false,
            resultViews,
            sourceRelation: runtime.sourceRelation,
            lastRunTime: Date.now(),
          };
        }),
      );

      void get().db.refreshTableSchemas();
      if (opts?.cascade && sheetId) {
        await get().cells.runDownstreamCascade(sheetId, id);
      }
    } catch (error) {
      set((s) =>
        produce(s, (draft) => {
          draft.cells.status[id] = {
            type: 'pivot',
            status: controller.signal.aborted ? 'cancel' : 'error',
            stale: true,
            resultViews:
              draft.cells.status[id]?.type === 'pivot'
                ? (draft.cells.status[id] as PivotCellStatus).resultViews
                : undefined,
            sourceRelation:
              draft.cells.status[id]?.type === 'pivot'
                ? (draft.cells.status[id] as PivotCellStatus).sourceRelation
                : undefined,
            lastError: error instanceof Error ? error.message : String(error),
          };
        }),
      );
    } finally {
      set((s) =>
        produce(s, (draft) => {
          delete draft.cells.activeAbortControllers[id];
        }),
      );
    }
  },
};
