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
import {InputCell} from './cells/InputCell';
import {MarkdownCell} from './cells/MarkdownCell';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {VegaCell} from './cells/VegaCell';
import {
  NotebookCell,
  NotebookCellTypes,
  NotebookSliceConfig,
} from './cellSchemas';

export type NotebookCellRegistryItem = {
  title: string;
  createCell: (id: string) => NotebookCell;
  renderComponent: (id: string) => any;
  findDependents: (
    changed: NotebookCell,
    cells: Record<string, NotebookCell>,
  ) => string[];
  runCell?: (cellId: string, opts?: {cascade?: boolean}) => Promise<void>;
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

    addCell: (tabId: string, type: NotebookCellTypes) => string;
    removeCell: (cellId: string) => void;
    renameCell: (cellId: string, name: string) => void;
    updateCell: (
      cellId: string,
      updater: (cell: NotebookCell) => NotebookCell,
    ) => void;

    runCell: (cellId: string, opts?: {cascade?: boolean}) => Promise<void>;
    runAllCells: (tabId: string) => Promise<void>;
    cancelRunCell: (cellId: string) => void;

    // registry of cell behaviors and renderers
    cellRegistry: Record<string, NotebookCellRegistryItem>;

    // cellStatus-only cell state
    cellStatus: Record<
      string,
      | {
          type: 'sql';
          status: 'idle' | 'running' | 'success' | 'error';
          lastError?: string;
          referencedTables?: string[];
          resultView?: string;
        }
      | {
          type: 'other';
        }
    >;
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
      tabs: [{id: defaultTabId, title: 'Notebook 1', cellOrder: []}],
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
  return createSlice<PC, NotebookSliceState>((set, get) => ({
    notebook: {
      schemaName: 'notebook',
      setSchemaName: (name) =>
        set((state) =>
          produce(state, (draft) => {
            draft.notebook.schemaName = name;
          }),
        ),

      cellStatus: {},

      addTab: () => {
        const id = createId();
        set((state) =>
          produce(state, (draft) => {
            draft.config.notebook.tabs.push({
              id,
              title: `Notebook ${draft.config.notebook.tabs.length + 1}`,
              cellOrder: [],
            });
            draft.config.notebook.currentTabId = id;
          }),
        );
        return id;
      },

      renameTab: (id, title) => {
        set((state) =>
          produce(state, (draft) => {
            const tab = draft.config.notebook.tabs.find((t) => t.id === id);
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

      addCell: (tabId, type) => {
        const id = createId();
        set((state) =>
          produce(state, (draft) => {
            const tab = draft.config.notebook.tabs.find((t) => t.id === tabId);
            if (!tab) return;
            const reg = get().notebook.cellRegistry[type];
            if (!reg) return;
            const cell = reg.createCell(id) as NotebookCell;
            draft.config.notebook.cells[id] = cell;
            tab.cellOrder.push(id);
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
          }),
        );
        return id;
      },

      removeCell: (cellId) => {
        set((state) =>
          produce(state, (draft) => {
            delete draft.config.notebook.cells[cellId];
            delete draft.notebook.cellStatus[cellId];
            for (const tab of draft.config.notebook.tabs) {
              tab.cellOrder = tab.cellOrder.filter((id) => id !== cellId);
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
        const reg = get().notebook.cellRegistry[next.type];
        if (reg) {
          const dependents = reg.findDependents(
            next,
            get().config.notebook.cells,
          );
          for (const depId of dependents) {
            void get().notebook.runCell(depId, {cascade: true});
          }
        }
      },

      cancelRunCell: (_cellId) => {
        // Future: wire to AbortController per cell
      },

      runAllCells: async (tabId) => {
        const tab = get().config.notebook.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        for (const cellId of tab.cellOrder) {
          await get().notebook.runCell(cellId, {cascade: false});
        }
      },

      runCell: async (cellId, opts) => {
        const cell = get().config.notebook.cells[cellId];
        if (!cell) return;
        const {runCell} = get().notebook.cellRegistry[cell.type] || {};
        if (runCell) {
          await runCell({id: cellId, opts});
        }
      },

      cellRegistry: {
        sql: {
          title: 'SQL',
          createCell: (id) =>
            ({
              id,
              type: 'sql',
              name: `cell_${id.slice(0, 5)}`,
              sql: '',
            }) as NotebookCell,
          renderComponent: (id: string) => React.createElement(SqlCell, {id}),
          findDependents: () => [],
          runCell: async ({id}) => {
            const cell = get().config.notebook.cells[id];
            if (!cell || cell.type !== 'sql') return;
            const rawSql = cell.sql || '';
            set((state) =>
              produce(state, (draft) => {
                const r = draft.notebook.cellStatus[id];
                if (r?.type === 'sql') {
                  r.status = 'running';
                  r.lastError = undefined;
                }
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
              );

              set((state) =>
                produce(state, (draft) => {
                  const r = draft.notebook.cellStatus[id];
                  if (r?.type === 'sql') {
                    r.status = 'success';
                    r.referencedTables = referenced.slice();
                  }
                }),
              );

              const cellsMap3 = get().config.notebook.cells;
              for (const key in cellsMap3) {
                const c = cellsMap3[key];
                if (c?.type === 'sql') {
                  const text = c.sql as string;
                  const refs = (get().notebook.cellStatus[c.id] as any)
                    ?.referencedTables as string[] | undefined;
                  if (
                    (text && text.indexOf(cell.name) >= 0) ||
                    (refs && refs.indexOf(tableName) >= 0)
                  ) {
                    await get().notebook.runCell(c.id, {cascade: false});
                  }
                }
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
            }
          },
        },
        text: {
          title: 'Text',
          createCell: (id) =>
            ({id, type: 'text', name: 'Text', text: ''}) as NotebookCell,
          renderComponent: (id: string) => React.createElement(TextCell, {id}),
          findDependents: () => [],
        },
        markdown: {
          title: 'Markdown',
          createCell: (id) =>
            ({
              id,
              type: 'markdown',
              name: 'Markdown',
              markdown: '',
            }) as NotebookCell,
          renderComponent: (id: string) =>
            React.createElement(MarkdownCell, {id}),
          findDependents: () => [],
        },
        vega: {
          title: 'Vega',
          createCell: (id) =>
            ({id, type: 'vega', name: 'Chart', sql: ''}) as NotebookCell,
          renderComponent: (id: string) => React.createElement(VegaCell, {id}),
          findDependents: () => [],
        },
        input: {
          title: 'Input',
          createCell: (id) =>
            ({
              id,
              type: 'input',
              name: 'Input',
              input: {kind: 'text', varName: 'var', value: ''},
            }) as NotebookCell,
          renderComponent: (id: string) => React.createElement(InputCell, {id}),
          findDependents: (changed, cells) => {
            if (changed.type !== 'input') return [];
            const varName = changed.input.varName;
            const dependents: string[] = [];
            for (const key in cells) {
              const c = cells[key];
              if (c?.type === 'sql') {
                const text = c.sql;
                if (
                  (text && text.indexOf(`{{${varName}}}`) >= 0) ||
                  (text && text.indexOf(`:${varName}`) >= 0)
                ) {
                  dependents.push(c.id);
                }
              }
            }
            return dependents;
          },
        },
      },
    },
  }));
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
