import {createId} from '@paralleldrive/cuid2';
import {escapeId, makeQualifiedTableName} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  useBaseRoomShellStore,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import React from 'react';
import {InputCell} from './cells/Input/InputCell';
import {generateUniqueName} from '@sqlrooms/utils';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {VegaCell} from './cells/Vega/VegaCell';
import {
  NotebookCell,
  NotebookCellTypes,
  NotebookSliceConfig,
} from './cellSchemas';
import {findTab, getCellTypeLabel} from './NotebookUtils';

export type NotebookCellRegistryItem = {
  title: string;
  createCell: (id: string) => NotebookCell;
  renderComponent: (id: string) => React.ReactElement;
  findDependencies: (
    cell: NotebookCell,
    cells: Record<string, NotebookCell>,
    status: NotebookSliceState['notebook']['cellStatus'],
  ) => string[];
  runCell?: (args: {id: string; opts?: {cascade?: boolean}}) => Promise<void>;
};

export type CellRegistry = Record<string, NotebookCellRegistryItem>;

export type NotebookSliceState = {
  notebook: {
    schemaName: string;
    setSchemaName: (name: string) => void;
    addTab: () => string;
    renameTab: (id: string, title: string) => void;
    setCurrentTab: (id: string) => void;
    removeTab: (id: string) => void;
    toggleShowInputBar: (id: string) => void;

    addCell: (tabId: string, type: NotebookCellTypes, index?: number) => string;
    moveCell: (tabId: string, cellId: string, direction: 'up' | 'down') => void;
    removeCell: (cellId: string) => void;
    renameCell: (cellId: string, name: string) => void;
    updateCell: (
      cellId: string,
      updater: (cell: NotebookCell) => NotebookCell,
    ) => void;
    setCurrentCell: (id: string) => void;

    runCell: (cellId: string, opts?: {cascade?: boolean}) => Promise<void>;
    runAllCells: (tabId: string) => Promise<void>;
    runAllCellsCascade: (tabId: string) => Promise<void>;
    cancelRunCell: (cellId: string) => void;

    // registry of cell behaviors and renderers
    cellRegistry: Record<string, NotebookCellRegistryItem>;

    // cellStatus-only cell state
    cellStatus: Record<
      string,
      | {
          type: 'sql';
          status: 'idle' | 'running' | 'success' | 'cancel' | 'error';
          lastError?: string;
          referencedTables?: string[];
          resultView?: string;
        }
      | {
          type: 'other';
        }
    >;

    activeAbortControllers: Record<string, AbortController>;
  };
};

/**
 * Create default `config.notebook` structure with one tab and no cells.
 */
export function createDefaultNotebookConfig(
  props: Partial<NotebookSliceConfig['notebook']> = {},
): NotebookSliceConfig {
  const defaultTabId = createId();
  return {
    notebook: {
      tabs: [
        {
          id: defaultTabId,
          title: 'Notebook 1',
          cellOrder: [],
          inputBarOrder: [],
          showInputBar: true,
        },
      ],
      currentTabId: defaultTabId,
      cells: {},
      ...props,
    },
  };
}

/**
 * Create the Notebook slice with tabs, cells, execution and dependency handling.
 * Supports pluggable custom renderers via options.
 */
export function createNotebookSlice<
  PC extends BaseRoomConfig & NotebookSliceConfig,
>() {
  return createSlice<PC, NotebookSliceState>((set, get) => {
    /**
     * Find dependencies for a cell by scanning other cells for references.
     * Matches input variables ({{var}} or :var) and SQL cell names or their result view names.
     */
    const findDependenciesCommon = (
      cell: NotebookCell,
      cells: Record<string, NotebookCell>,
      status: NotebookSliceState['notebook']['cellStatus'],
    ): string[] => {
      const deps: string[] = [];
      const text = (cell as any).sql as string;
      for (const otherId in cells) {
        if (otherId === cell.id) continue;
        const other = cells[otherId];
        if (!other) continue;
        if (other.type === 'input') {
          const vn = other.input.varName;
          if (
            (text && text.indexOf(`{{${vn}}}`) >= 0) ||
            (text && text.indexOf(`:${vn}`) >= 0)
          )
            deps.push(other.id);
        } else if (other.type === 'sql') {
          const st = status[other.id];
          const otherView = st && st.type === 'sql' ? st.resultView : undefined;
          if (
            (text && text.indexOf(other.name) >= 0) ||
            (otherView && text && text.indexOf(otherView) >= 0)
          )
            deps.push(other.id);
        }
      }
      return Array.from(new Set(deps));
    };

    /**
     * Cascade execution to cells that depend on the given source cell id.
     */
    const cascadeFrom = async (sourceCellId: string) => {
      const cellsMap = get().config.notebook.cells;
      const statusMap = get().notebook.cellStatus;
      for (const candidateId in cellsMap) {
        if (candidateId === sourceCellId) continue;
        const candidate = cellsMap[candidateId];
        if (!candidate) continue;
        const reg2 = get().notebook.cellRegistry[candidate.type];
        if (!reg2 || !reg2.findDependencies) continue;
        const deps = reg2.findDependencies(candidate, cellsMap, statusMap);
        if (deps.indexOf(sourceCellId) >= 0) {
          await get().notebook.runCell(candidateId, {cascade: true});
        }
      }
    };

    return {
      notebook: {
        schemaName: 'notebook',
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
              draft.config.notebook.tabs.push({
                id,
                title: `Notebook ${draft.config.notebook.tabs.length + 1}`,
                cellOrder: [],
                inputBarOrder: [],
                showInputBar: true,
              });
              draft.config.notebook.currentTabId = id;
            }),
          );
          return id;
        },

        renameTab: (id, title) => {
          set((state) =>
            produce(state, (draft) => {
              const tab = findTab(draft.config.notebook, id);
              if (tab) tab.title = title;
            }),
          );
        },

        setCurrentTab: (id) => {
          set((state) =>
            produce(state, (draft) => {
              draft.config.notebook.currentTabId = id;
            }),
          );
        },

        removeTab: (id) => {
          const tab = get().config.notebook.tabs.find((t) => t.id === id);
          if (tab) {
            for (const cellId of tab.cellOrder) {
              const abortController =
                get().notebook.activeAbortControllers[cellId];
              if (abortController) {
                abortController.abort();
              }
            }
          }

          set((state) =>
            produce(state, (draft) => {
              draft.config.notebook.tabs = draft.config.notebook.tabs.filter(
                (t) => t.id !== id,
              );
              if (draft.config.notebook.currentTabId === id) {
                draft.config.notebook.currentTabId =
                  draft.config.notebook.tabs[0]?.id;
              }
            }),
          );
        },

        toggleShowInputBar: (id) => {
          set((state) =>
            produce(state, (draft) => {
              const tab = findTab(draft.config.notebook, id);
              if (tab) tab.showInputBar = !tab.showInputBar;
            }),
          );
        },

        addCell: (tabId, type, index) => {
          const id = createId();
          set((state) =>
            produce(state, (draft) => {
              const tab = findTab(draft.config.notebook, tabId);
              const reg = get().notebook.cellRegistry[type];
              if (!reg) return;
              const cell = reg.createCell(id) as NotebookCell;
              // Assign a readable unique name using shared utility
              const usedNames = Object.values(draft.config.notebook.cells).map(
                (c) => c.name,
              );
              const baseLabel = getCellTypeLabel(cell.type);
              if (baseLabel) {
                (cell as any).name = generateUniqueName(baseLabel, usedNames);
              }
              draft.config.notebook.cells[id] = cell;

              // cellOrder
              const newIndex = index ?? tab.cellOrder.length;
              tab.cellOrder = [
                ...tab.cellOrder.slice(0, newIndex),
                id,
                ...tab.cellOrder.slice(newIndex),
              ];

              // inputBarOrder
              if (type === 'input') {
                tab.inputBarOrder = [
                  ...tab.inputBarOrder.slice(0, newIndex),
                  id,
                  ...tab.inputBarOrder.slice(newIndex),
                ];
              }

              // cellStatus
              if (type === 'sql') {
                draft.notebook.cellStatus[id] = {
                  type: 'sql',
                  status: 'idle',
                  referencedTables: [],
                  resultView: makeQualifiedTableName({
                    table: cell.name,
                    schema: get().notebook.schemaName,
                    database: get().db.currentDatabase,
                  }).toString(),
                };
              } else {
                draft.notebook.cellStatus[id] = {type: 'other'};
              }

              draft.config.notebook.currentCellId = id;
            }),
          );
          return id;
        },

        moveCell: (tabId, cellId, direction) => {
          set((state) =>
            produce(state, (draft) => {
              const tab = findTab(draft.config.notebook, tabId);

              const idx = tab.cellOrder.indexOf(cellId);
              if (idx >= 0) {
                const newIndex = direction === 'up' ? idx - 1 : idx + 1;
                if (newIndex < 0 || newIndex >= tab.cellOrder.length) return;

                tab.cellOrder.splice(idx, 1);
                tab.cellOrder.splice(newIndex, 0, cellId);
              }
            }),
          );
        },

        removeCell: (cellId) => {
          const abortController = get().notebook.activeAbortControllers[cellId];
          if (abortController) {
            abortController.abort();
          }

          set((state) =>
            produce(state, (draft) => {
              delete draft.config.notebook.cells[cellId];
              delete draft.notebook.cellStatus[cellId];
              delete draft.notebook.activeAbortControllers[cellId];
              for (const tab of draft.config.notebook.tabs) {
                tab.cellOrder = tab.cellOrder.filter((id) => id !== cellId);
                tab.inputBarOrder = tab.inputBarOrder.filter(
                  (id) => id !== cellId,
                );
              }
            }),
          );
        },

        renameCell: (cellId, name) => {
          set((state) =>
            produce(state, (draft) => {
              const cell = draft.config.notebook.cells[cellId];
              if (cell && 'name' in cell) cell.name = name;
            }),
          );
        },

        updateCell: (cellId, updater) => {
          set((state) =>
            produce(state, (draft) => {
              const cell = draft.config.notebook.cells[cellId];
              if (!cell) return;
              draft.config.notebook.cells[cellId] = updater(cell);
            }),
          );
          const next = get().config.notebook.cells[cellId];
          if (!next) return;
          void cascadeFrom(cellId);
        },

        setCurrentCell: (id) => {
          set((state) =>
            produce(state, (draft) => {
              draft.config.notebook.currentCellId = id;
            }),
          );
        },

        cancelRunCell: (cellId) => {
          const abortController = get().notebook.activeAbortControllers[cellId];
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
          const tab = findTab(get().config.notebook, tabId);
          for (const cellId of tab.cellOrder) {
            await get().notebook.runCell(cellId, {cascade: false});
          }
        },

        runAllCellsCascade: async (tabId) => {
          const tab = findTab(get().config.notebook, tabId);
          const cellsMap = get().config.notebook.cells;
          const statusMap = get().notebook.cellStatus;
          const rootCells: string[] = tab.cellOrder.filter((cellId) => {
            const cell = cellsMap[cellId];
            if (!cell) return false;
            const reg = get().notebook.cellRegistry[cell.type];
            if (!reg) return true;
            const deps = reg.findDependencies(cell, cellsMap, statusMap);
            return deps.length === 0;
          });
          for (const cellId of rootCells) {
            await get().notebook.runCell(cellId, {cascade: true});
          }
        },

        runCell: async (cellId, opts) => {
          const cell = get().config.notebook.cells[cellId];
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
            renderComponent: (id: string) => React.createElement(SqlCell, {id}),
            findDependencies: findDependenciesCommon,
            runCell: async ({id, opts}) => {
              const cell = get().config.notebook.cells[id];
              if (!cell || cell.type !== 'sql') return;
              const rawSql = cell.sql || '';

              const abortController = new AbortController();
              set((state) =>
                produce(state, (draft) => {
                  draft.notebook.activeAbortControllers[id] = abortController;
                  draft.notebook.cellStatus[id] = {
                    type: 'sql',
                    status: 'running',
                    lastError: undefined,
                  };
                }),
              );

              try {
                const inputs: any[] = [];
                const cellsMap2 = get().config.notebook.cells;
                for (const key in cellsMap2) {
                  const c = cellsMap2[key];
                  if (c?.type === 'input') inputs.push(c);
                }
                const varMap: Record<string, string | number> = {};
                for (const iv of inputs) {
                  varMap[iv.input.varName] = iv.input.value;
                }
                const renderedSql = rawSql.replace(
                  /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
                  (_m: string, v: string) => {
                    const val = varMap[v];
                    return typeof val === 'number'
                      ? String(val)
                      : `'${String(val ?? '')?.replace(/'/g, "''")}'`;
                  },
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
                      r.resultView = makeQualifiedTableName({
                        table: cell.name,
                        schema: get().notebook.schemaName,
                        database: get().db.currentDatabase,
                      }).toString();
                    }
                  }),
                );

                if (opts?.cascade !== false) {
                  await cascadeFrom(id);
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
                input: {kind: 'text', varName: 'param_1', value: ''},
              }) as NotebookCell,
            renderComponent: (id: string) =>
              React.createElement(InputCell, {id}),
            findDependencies: () => [],
          },
        },
      },
    };
  });
}

export type RoomConfigWithNotebook = BaseRoomConfig & NotebookSliceConfig;
export type RoomShellSliceStateWithNotebook =
  RoomShellSliceState<RoomConfigWithNotebook> & NotebookSliceState;

export function useStoreWithNotebook<T>(
  selector: (state: RoomShellSliceStateWithNotebook) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & NotebookSliceConfig,
    RoomShellSliceState<RoomConfigWithNotebook>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithNotebook));
}
