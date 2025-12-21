import {createId} from '@paralleldrive/cuid2';
import {CanvasSliceState} from '@sqlrooms/canvas';
import {
  createDagSlice,
  findSqlDependencies,
  type Cell,
  type CellsRootState,
  type DagConfig,
  type DagSliceState,
} from '@sqlrooms/cells';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import React from 'react';
import {InputCell} from './cells/Input/InputCell';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {VegaCell} from './cells/Vega/VegaCell';
import {
  NotebookCell,
  NotebookSliceConfig,
  NotebookDagMeta,
  NotebookDag,
} from './cellSchemas';
import {getCellTypeLabel} from './NotebookUtils';
import type {NotebookSliceState} from './NotebookStateTypes';

/**
 * Create default `notebook.config` structure with one tab and no cells.
 */
export function createDefaultNotebookConfig(
  props: Partial<NotebookSliceConfig> = {},
): NotebookSliceConfig {
  const defaultTabId = createId();
  const base: NotebookSliceConfig = {
    dags: {
      [defaultTabId]: {
        id: defaultTabId,
        meta: {
          title: 'Notebook 1',
          cellOrder: [],
          inputBarOrder: [],
          showInputBar: true,
        },
      },
    },
    dagOrder: [defaultTabId],
    currentDagId: defaultTabId,
    currentCellId: undefined,
  };

  return {...base, ...props};
}

function getDag(
  config: NotebookSliceConfig,
  dagId: string,
): NotebookDag | undefined {
  return config.dags[dagId];
}

type NotebookRootState = BaseRoomStoreState &
  DuckDbSliceState &
  NotebookSliceState &
  DagSliceState &
  CellsRootState &
  CanvasSliceState;

/**
 * Create the Notebook slice with tabs, cells, execution and dependency handling.
 */
export function createNotebookSlice(props?: {
  config?: Partial<NotebookSliceConfig>;
}) {
  return createSlice<NotebookSliceState & DagSliceState, NotebookRootState>(
    (set, get, store) => {
      const dagSlice = createDagSlice<
        NotebookRootState,
        NotebookCell,
        NotebookDagMeta
      >({
        getDagConfig: (state) => {
          const config = state.notebook.config;
          const dags: Record<string, any> = {};
          for (const [id, dag] of Object.entries(config.dags)) {
            const cells: Record<string, any> = {};
            for (const cellId of (dag as NotebookDag).meta.cellOrder) {
              const cell = state.cells.data[cellId];
              if (cell) {
                cells[cellId] = cell;
              }
            }
            dags[id] = {...(dag as NotebookDag), cells};
          }
          return {...config, dags} as unknown as DagConfig<
            NotebookCell,
            NotebookDagMeta
          >;
        },
        findDependencies: ({cell, cells, getState}) => {
          const reg =
            getState().notebook.cellRegistry[(cell as NotebookCell).type];
          if (!reg?.findDependencies) return [];
          return reg.findDependencies(
            cell as NotebookCell,
            cells,
            getState().cells.status,
          );
        },
        runCell: async ({cellId, cascade, getState}) => {
          await getState().notebook.runCell(cellId, {cascade});
        },
      })(set as any, get as any, store);

      return {
        ...(dagSlice as any),
        notebook: {
          schemaName: 'notebook',
          config: createDefaultNotebookConfig(props?.config ?? {}),

          setSchemaName: (name: string) =>
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                draft.notebook.schemaName = name;
              }),
            ),

          addTab: () => {
            const id = createId();
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                draft.notebook.config.dags[id] = {
                  id,
                  meta: {
                    title: `Notebook ${draft.notebook.config.dagOrder.length + 1}`,
                    cellOrder: [],
                    inputBarOrder: [],
                    showInputBar: true,
                  },
                };
                draft.notebook.config.dagOrder.push(id);
                draft.notebook.config.currentDagId = id;
              }),
            );
            return id;
          },

          renameTab: (id: string, title: string) => {
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                const dag = getDag(draft.notebook.config, id);
                if (dag) dag.meta.title = title;
              }),
            );
          },

          setCurrentTab: (id: string) => {
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                draft.notebook.config.currentDagId = id;
              }),
            );
          },

          removeTab: (id: string) => {
            const dag = getDag(get().notebook.config, id);
            if (dag) {
              for (const cellId of dag.meta.cellOrder) {
                get().cells.cancelCell(cellId);
              }
            }

            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                const toDelete = draft.notebook.config.dags[id];
                if (!toDelete) return;
                for (const cellId of toDelete.meta.cellOrder) {
                  draft.cells.removeCell(cellId);
                }
                delete draft.notebook.config.dags[id];
                draft.notebook.config.dagOrder =
                  draft.notebook.config.dagOrder.filter(
                    (dagId) => dagId !== id,
                  );
                if (draft.notebook.config.currentDagId === id) {
                  draft.notebook.config.currentDagId =
                    draft.notebook.config.dagOrder[0];
                }
              }),
            );
          },

          toggleShowInputBar: (id: string) => {
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                const dag = getDag(draft.notebook.config, id);
                if (dag) dag.meta.showInputBar = !dag.meta.showInputBar;
              }),
            );
          },

          addCell: (tabId: string, type: string, index?: number) => {
            const id = createId();
            const dag = getDag(get().notebook.config, tabId);
            if (!dag) return '';

            const reg = get().notebook.cellRegistry[type];
            if (!reg) return '';

            const cell = reg.createCell(id) as NotebookCell;
            const usedNames = Object.values(get().cells.data)
              .filter((c: Cell) => dag.meta.cellOrder.includes(c.id))
              .map((c: Cell) => (c.data as any).title);

            const baseLabel = getCellTypeLabel(cell.type as any);
            if (baseLabel) {
              (cell.data as any).title = generateUniqueName(
                baseLabel,
                usedNames,
              );
            }

            if (type === 'input') {
              const usedInputNames = Object.values(get().cells.data)
                .filter((c: Cell) => c.type === 'input')
                .map((c: Cell) => (c.data as any).input.varName);
              (cell.data as any).input.varName = generateUniqueName(
                (cell.data as any).input.varName,
                usedInputNames,
              );
            }

            get().cells.addCell(cell as any as Cell);

            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                const d = getDag(draft.notebook.config, tabId);
                if (!d) return;

                // NEW: Also add to canvas current DAG if it exists
                if (draft.canvas?.config?.currentDagId) {
                  const canvasDag =
                    draft.canvas.config.dags[draft.canvas.config.currentDagId];
                  if (canvasDag) {
                    canvasDag.cells[id] = {
                      id,
                      position: {x: 100, y: 100}, // Default position
                      width: 800,
                      height: 600,
                      data: {},
                    };
                    canvasDag.meta.nodeOrder.push(id);
                  }
                }

                const newIndex = index ?? d.meta.cellOrder.length;
                d.meta.cellOrder.splice(newIndex, 0, id);

                if (type === 'input') {
                  d.meta.inputBarOrder.splice(newIndex, 0, id);
                }

                draft.notebook.config.currentCellId = id;
              }),
            );
            return id;
          },

          moveCell: (
            tabId: string,
            cellId: string,
            direction: 'up' | 'down',
          ) => {
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                const dag = getDag(draft.notebook.config, tabId);
                if (!dag) return;

                const idx = dag.meta.cellOrder.indexOf(cellId);
                if (idx >= 0) {
                  const newIndex = direction === 'up' ? idx - 1 : idx + 1;
                  if (newIndex < 0 || newIndex >= dag.meta.cellOrder.length)
                    return;

                  dag.meta.cellOrder.splice(idx, 1);
                  dag.meta.cellOrder.splice(newIndex, 0, cellId);
                }
              }),
            );
          },

          removeCell: (cellId: string) => {
            get().cells.removeCell(cellId);
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                for (const dag of Object.values(draft.notebook.config.dags)) {
                  dag.meta.cellOrder = dag.meta.cellOrder.filter(
                    (id: string) => id !== cellId,
                  );
                  dag.meta.inputBarOrder = dag.meta.inputBarOrder.filter(
                    (id: string) => id !== cellId,
                  );
                }
              }),
            );
          },

          renameCell: (cellId: string, name: string) => {
            get().cells.updateCell(cellId, (cell: Cell) =>
              produce(cell, (draft: Cell) => {
                (draft.data as any).title = name;
              }),
            );
          },

          updateCell: (
            cellId: string,
            updater: (cell: NotebookCell) => NotebookCell,
          ) => {
            get().cells.updateCell(cellId, updater as any);
          },

          setCurrentCell: (id: string) => {
            set((state: NotebookRootState) =>
              produce(state, (draft: NotebookRootState) => {
                draft.notebook.config.currentCellId = id;
              }),
            );
          },

          cancelRunCell: (cellId: string) => {
            get().cells.cancelCell(cellId);
          },

          runAllCells: async (tabId: string) => {
            const dag = getDag(get().notebook.config, tabId);
            if (!dag) return;
            for (const cellId of dag.meta.cellOrder) {
              await get().notebook.runCell(cellId, {cascade: false});
            }
          },

          runAllCellsCascade: async (tabId: string) => {
            await get().dag.runAllCellsCascade(tabId);
          },

          runCell: async (cellId: string, opts?: {cascade?: boolean}) => {
            await get().cells.runCell(cellId, {
              ...opts,
              schemaName: get().notebook.schemaName,
            });
          },

          cellRegistry: {
            sql: {
              title: 'SQL',
              createCell: (id: string) =>
                ({
                  id,
                  type: 'sql',
                  data: {title: 'SQL', sql: ''},
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(SqlCell, {id}),
              findDependencies: findDependenciesCommon,
            },
            text: {
              title: 'Text',
              createCell: (id: string) =>
                ({
                  id,
                  type: 'text',
                  data: {title: 'Text', text: ''},
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(TextCell, {id}),
              findDependencies: () => [],
            },
            vega: {
              title: 'Vega',
              createCell: (id: string) =>
                ({
                  id,
                  type: 'vega',
                  data: {title: 'Chart', sqlId: ''},
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(VegaCell, {id}),
              findDependencies: findDependenciesCommon,
            },
            input: {
              title: 'Input',
              createCell: (id: string) =>
                ({
                  id,
                  type: 'input',
                  data: {
                    title: 'Input',
                    input: {kind: 'text', varName: 'input_1', value: ''},
                  },
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(InputCell, {id}),
              findDependencies: () => [],
            },
          },
        },
      };
    },
  );
}

/**
 * Find dependencies for a cell by scanning other cells for references.
 */
function findDependenciesCommon(
  cell: NotebookCell,
  cells: Record<string, NotebookCell>,
  status: Record<string, any>,
): string[] {
  return findSqlDependencies({
    targetCell: cell as any,
    cells: cells as any,
    getSqlText: (c: any) => c.data?.sql,
    getInputVarName: (c: any) => c.data?.input?.varName,
    getSqlResultName: (cellId) => {
      const st = status[cellId];
      return st && st.type === 'sql' ? st.resultView : undefined;
    },
  });
}
