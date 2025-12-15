import {createId} from '@paralleldrive/cuid2';
import {
  DagSliceState,
  createDagSlice,
  findSqlDependencies,
  renderSqlWithInputs,
} from '@sqlrooms/cells';
import {
  DuckDbSliceState,
  escapeId,
  makeQualifiedTableName,
} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import React from 'react';
import {InputCell} from './cells/Input/InputCell';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {VegaCell} from './cells/Vega/VegaCell';
import {
  InputCell as InputCellType,
  NotebookCell,
  NotebookCellTypes,
  NotebookSliceConfig,
  NotebookDagMeta,
} from './cellSchemas';
import {getCellTypeLabel} from './NotebookUtils';
import type {
  CellRegistry,
  NotebookCellRegistryItem,
  NotebookSliceState,
} from './NotebookStateTypes';

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
        cells: {},
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

  // If already a DAG config, merge over the base
  return {...base, ...props};
}

function getDag(config: NotebookSliceConfig, dagId: string) {
  return config.dags[dagId];
}

function findDagIdByCellId(
  config: NotebookSliceConfig,
  cellId: string,
): string | undefined {
  for (const [dagId, dag] of Object.entries(config.dags)) {
    if (dag?.cells[cellId]) {
      return dagId;
    }
  }
  return undefined;
}

/**
 * Create the Notebook slice with tabs, cells, execution and dependency handling.
 * Supports pluggable custom renderers via options.
 */
export function createNotebookSlice(props?: {
  config?: Partial<NotebookSliceConfig>;
}) {
  type NotebookRootState = BaseRoomStoreState &
    DuckDbSliceState &
    NotebookSliceState &
    DagSliceState;

  return createSlice<NotebookSliceState & DagSliceState, NotebookRootState>(
    (set, get, store) => {
      const dagSlice = createDagSlice<
        NotebookRootState,
        NotebookCell,
        NotebookDagMeta
      >({
        getDagConfig: (state) => state.notebook.config,
        findDependencies: ({cell, cells, getState}) => {
          const reg =
            getState().notebook.cellRegistry[(cell as NotebookCell).type];
          if (!reg?.findDependencies) return [];
          return reg.findDependencies(
            cell as NotebookCell,
            cells,
            getState().notebook.cellStatus,
          );
        },
        runCell: async ({cellId, cascade, getState}) => {
          await getState().notebook.runCell(cellId, {cascade});
        },
      })(set as any, get as any, store);

      return {
        ...dagSlice,
        notebook: {
          schemaName: 'notebook',

          config: createDefaultNotebookConfig(props?.config ?? {}),

          setSchemaName: (name) =>
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.schemaName = name;
              }),
            ),

          cellStatus: {},
          activeAbortControllers: {},

          addTab: () => {
            const id = createId();
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.dags[id] = {
                  id,
                  cells: {},
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

          renameTab: (id, title) => {
            set((state) =>
              produce(state, (draft) => {
                const dag = getDag(draft.notebook.config, id);
                if (dag) dag.meta.title = title;
              }),
            );
          },

          setCurrentTab: (id) => {
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.currentDagId = id;
              }),
            );
          },

          removeTab: (id) => {
            const dag = getDag(get().notebook.config, id);
            if (dag) {
              for (const cellId of dag.meta.cellOrder) {
                const abortController =
                  get().notebook.activeAbortControllers[cellId];
                if (abortController) {
                  abortController.abort();
                }
              }
            }

            set((state) =>
              produce(state, (draft) => {
                const toDelete = draft.notebook.config.dags[id];
                if (!toDelete) return;
                for (const cellId of Object.keys(toDelete.cells)) {
                  delete toDelete.cells[cellId];
                  delete draft.notebook.cellStatus[cellId];
                  delete draft.notebook.activeAbortControllers[cellId];
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

          toggleShowInputBar: (id) => {
            set((state) =>
              produce(state, (draft) => {
                const dag = getDag(draft.notebook.config, id);
                if (dag) dag.meta.showInputBar = !dag.meta.showInputBar;
              }),
            );
          },

          addCell: (tabId, type, index) => {
            const id = createId();
            set((state) =>
              produce(state, (draft) => {
                const dag = getDag(draft.notebook.config, tabId);
                if (!dag) return;
                const reg = get().notebook.cellRegistry[type];
                if (!reg) return;
                const cell = reg.createCell(id) as NotebookCell;
                // Assign a readable unique name using shared utility
                const usedNames = Object.values(dag.cells).map((c) => c.name);
                const baseLabel = getCellTypeLabel(cell.type);
                if (baseLabel) {
                  (cell as any).name = generateUniqueName(baseLabel, usedNames);
                }

                if (type === 'input') {
                  const usedInputNames = Object.values(dag.cells)
                    .filter((c) => c.type === 'input')
                    .map((c) => c.input.varName);
                  (cell as InputCellType).input.varName = generateUniqueName(
                    (cell as InputCellType).input.varName,
                    usedInputNames,
                  );
                }
                dag.cells[id] = cell;

                // cellOrder
                const newIndex = index ?? dag.meta.cellOrder.length;
                dag.meta.cellOrder = [
                  ...dag.meta.cellOrder.slice(0, newIndex),
                  id,
                  ...dag.meta.cellOrder.slice(newIndex),
                ];

                // inputBarOrder
                if (type === 'input') {
                  dag.meta.inputBarOrder = [
                    ...dag.meta.inputBarOrder.slice(0, newIndex),
                    id,
                    ...dag.meta.inputBarOrder.slice(newIndex),
                  ];
                }

                // cellStatus
                if (type === 'sql') {
                  draft.notebook.cellStatus[id] = {
                    type: 'sql',
                    status: 'idle',
                    referencedTables: [],
                  };
                } else {
                  draft.notebook.cellStatus[id] = {type: 'other'};
                }

                draft.notebook.config.currentCellId = id;
              }),
            );
            return id;
          },

          moveCell: (tabId, cellId, direction) => {
            set((state) =>
              produce(state, (draft) => {
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

          removeCell: (cellId) => {
            const abortController =
              get().notebook.activeAbortControllers[cellId];
            if (abortController) {
              abortController.abort();
            }

            set((state) =>
              produce(state, (draft) => {
                const dagId = findDagIdByCellId(draft.notebook.config, cellId);
                if (!dagId) return;
                const dag = getDag(draft.notebook.config, dagId);
                if (!dag) return;

                delete dag.cells[cellId];
                delete draft.notebook.cellStatus[cellId];
                delete draft.notebook.activeAbortControllers[cellId];

                dag.meta.cellOrder = dag.meta.cellOrder.filter(
                  (id) => id !== cellId,
                );
                dag.meta.inputBarOrder = dag.meta.inputBarOrder.filter(
                  (id) => id !== cellId,
                );
              }),
            );
          },

          renameCell: (cellId, name) => {
            set((state) =>
              produce(state, (draft) => {
                const dagId = findDagIdByCellId(draft.notebook.config, cellId);
                if (!dagId) return;
                const dag = getDag(draft.notebook.config, dagId);
                if (!dag) return;
                const cell = dag.cells[cellId];
                if (cell && 'name' in cell) (cell as any).name = name;
              }),
            );
          },

          updateCell: (cellId, updater) => {
            set((state) =>
              produce(state, (draft) => {
                const dagId = findDagIdByCellId(draft.notebook.config, cellId);
                if (!dagId) return;
                const dag = getDag(draft.notebook.config, dagId);
                if (!dag) return;
                const cell = dag.cells[cellId];
                if (!cell) return;
                dag.cells[cellId] = updater(cell);
              }),
            );
            const dagId = findDagIdByCellId(get().notebook.config, cellId);
            if (!dagId) return;
            const nextDag = getDag(get().notebook.config, dagId);
            if (!nextDag?.cells[cellId]) return;
            void get().dag.runDownstreamCascade(dagId, cellId);
          },

          setCurrentCell: (id) => {
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.currentCellId = id;
              }),
            );
          },

          cancelRunCell: (cellId) => {
            const abortController =
              get().notebook.activeAbortControllers[cellId];
            if (abortController) {
              abortController.abort();
              set((state) =>
                produce(state, (draft) => {
                  delete draft.notebook.activeAbortControllers[cellId];
                  const cellStatus = draft.notebook.cellStatus[cellId];
                  if (cellStatus?.type === 'sql') {
                    cellStatus.status = 'cancel';
                    cellStatus.lastError = 'Query cancelled by user';
                  }
                }),
              );
            }
          },

          runAllCells: async (tabId) => {
            const dag = getDag(get().notebook.config, tabId);
            if (!dag) return;
            for (const cellId of dag.meta.cellOrder) {
              await get().notebook.runCell(cellId, {cascade: false});
            }
          },

          runAllCellsCascade: async (tabId) => {
            await get().dag.runAllCellsCascade(tabId);
          },

          runCell: async (cellId, opts) => {
            const dagId = findDagIdByCellId(get().notebook.config, cellId);
            if (!dagId) return;
            const dag = getDag(get().notebook.config, dagId);
            const cell = dag?.cells[cellId];
            if (!cell) return;
            const {runCell} = get().notebook.cellRegistry[cell.type] || {};
            if (runCell) {
              await runCell({id: cellId, opts: opts || {}});
            }
          },

          cellRegistry: {
            sql: {
              title: 'SQL',
              createCell: (id) =>
                ({
                  id,
                  type: 'sql',
                  name: 'SQL',
                  sql: '',
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(SqlCell, {id}),
              findDependencies: findDependenciesCommon,
              runCell: async ({id, opts}) => {
                const dagId = findDagIdByCellId(get().notebook.config, id);
                if (!dagId) return;
                const dag = getDag(get().notebook.config, dagId);
                const cell = dag?.cells[id];
                if (!cell || cell.type !== 'sql') return;
                const rawSql = cell.sql || '';

                const abortController = new AbortController();
                set((state) =>
                  produce(state, (draft) => {
                    draft.notebook.activeAbortControllers[id] = abortController;
                    draft.notebook.cellStatus[id] = {
                      type: 'sql',
                      status: 'running',
                      resultView:
                        draft.notebook.cellStatus[id]?.type === 'sql'
                          ? draft.notebook.cellStatus[id].resultView
                          : undefined,
                      lastError: undefined,
                    };
                  }),
                );

                try {
                  const inputs: any[] = [];
                  const cellsMap2 = dag?.cells ?? {};
                  for (const key in cellsMap2) {
                    const c = cellsMap2[key];
                    if (c?.type === 'input') inputs.push(c);
                  }
                  const renderedSql = renderSqlWithInputs(
                    rawSql,
                    inputs.map((iv) => ({
                      varName: iv.input.varName,
                      value: iv.input.value,
                    })),
                  );

                  const connector = await get().db.getConnector();
                  const schemaName: string =
                    get().notebook.schemaName || 'notebook';
                  await connector.query(
                    `CREATE SCHEMA IF NOT EXISTS ${schemaName}`,
                    {signal: abortController.signal},
                  );

                  const parsed = await get().db.sqlSelectToJson(renderedSql);
                  if (parsed.error) {
                    throw new Error(
                      parsed.error_message || 'Not a valid SELECT statement',
                    );
                  }

                  const referenced: string[] = [];
                  const stmts = (parsed.statements || []) as any[];
                  for (const s of stmts) {
                    const from = s?.node?.from_table;
                    if (from?.table_name) {
                      const schema = from.schema_name || 'main';
                      const ref = `${schema}.${from.table_name}`;
                      if (referenced.indexOf(ref) < 0) referenced.push(ref);
                    }
                  }

                  const tableName = `${schemaName}.${escapeId(cell.name)}`;
                  await connector.query(
                    `CREATE OR REPLACE VIEW ${tableName} AS ${renderedSql}`,
                    {signal: abortController.signal},
                  );

                  set((state) =>
                    produce(state, (draft) => {
                      const r = draft.notebook.cellStatus[id];
                      if (r?.type === 'sql') {
                        r.status = 'success';
                        r.referencedTables = referenced.slice();
                        const resultView = makeQualifiedTableName({
                          table: cell.name,
                          schema: get().notebook.schemaName,
                          database: get().db.currentDatabase,
                        }).toString();
                        r.resultView = resultView;
                        r.resultName = resultView;
                        r.lastRunTime = Date.now();
                      }
                    }),
                  );

                  if (opts?.cascade !== false) {
                    await get().dag.runDownstreamCascade(dagId, id);
                  }
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  set((state) =>
                    produce(state, (draft) => {
                      const r = draft.notebook.cellStatus[id];
                      if (r?.type === 'sql') {
                        r.status = 'error';
                        r.lastError = message;
                      }
                    }),
                  );
                } finally {
                  // Clean up the abort controller
                  set((state) =>
                    produce(state, (draft) => {
                      delete draft.notebook.activeAbortControllers[id];
                    }),
                  );
                }
              },
            },
            text: {
              title: 'Text',
              createCell: (id) =>
                ({id, type: 'text', name: 'Text', text: ''}) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(TextCell, {id}),
              findDependencies: () => [],
            },
            vega: {
              title: 'Vega',
              createCell: (id) =>
                ({id, type: 'vega', name: 'Chart', sqlId: ''}) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(VegaCell, {id}),
              findDependencies: findDependenciesCommon,
            },
            input: {
              title: 'Input',
              createCell: (id) =>
                ({
                  id,
                  type: 'input',
                  name: 'Input',
                  input: {kind: 'text', varName: 'input_1', value: ''},
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
 * Matches input variables ({{var}} or :var) and SQL cell names or their result view names.
 */
function findDependenciesCommon(
  cell: NotebookCell,
  cells: Record<string, NotebookCell>,
  status: NotebookSliceState['notebook']['cellStatus'],
): string[] {
  return findSqlDependencies({
    targetCell: cell,
    cells,
    getSqlText: (c) => (c as any).sql,
    getInputVarName: (c) => (c as any).input?.varName,
    getSqlResultName: (cellId) => {
      const st = status[cellId];
      return st && st.type === 'sql' ? st.resultView : undefined;
    },
  });
}
