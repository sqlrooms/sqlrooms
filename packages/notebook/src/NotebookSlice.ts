import {createId} from '@paralleldrive/cuid2';
import {escapeId} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  useBaseRoomShellStore,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import React from 'react';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {MarkdownCell} from './cells/MarkdownCell';
import {VegaCell} from './cells/VegaCell';
import {InputCell} from './cells/InputCell';
import {z} from 'zod';

/**
 * DuckDB schema used for storing notebook SQL cell views.
 */
const NOTEBOOK_SCHEMA_NAME = 'notebook';

export const NotebookCellTypes = z.enum([
  'sql',
  'markdown',
  'text',
  'vega',
  'input',
]);
export type NotebookCellTypes = z.infer<typeof NotebookCellTypes>;

export const NotebookCellSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    name: z.string().default('Untitled'),
    type: z.literal('sql'),
    sql: z.string().default(''),
    status: z.enum(['idle', 'running', 'success', 'error']).default('idle'),
    lastError: z.string().optional(),
    lastQueryStatement: z.string().optional(),
    outputTable: z.string().optional(),
    referencedTables: z.array(z.string()).default([]),
  }),
  z.object({
    id: z.string(),
    name: z.string().default('Text'),
    type: z.literal('text'),
    text: z.string().default(''),
  }),
  z.object({
    id: z.string(),
    name: z.string().default('Markdown'),
    type: z.literal('markdown'),
    markdown: z.string().default(''),
  }),
  z.object({
    id: z.string(),
    name: z.string().default('Chart'),
    type: z.literal('vega'),
    sql: z.string().default(''),
    vegaSpec: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    name: z.string().default('Input'),
    type: z.literal('input'),
    input: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('slider'),
        varName: z.string(),
        min: z.number().default(0),
        max: z.number().default(100),
        step: z.number().default(1),
        value: z.number().default(0),
      }),
      z.object({
        kind: z.literal('text'),
        varName: z.string(),
        value: z.string().default(''),
      }),
      z.object({
        kind: z.literal('dropdown'),
        varName: z.string(),
        options: z.array(z.string()).default([]),
        value: z.string().default(''),
      }),
    ]),
  }),
]);
export type NotebookCell = z.infer<typeof NotebookCellSchema>;

export const NotebookTabSchema = z.object({
  id: z.string(),
  title: z.string().default('Notebook'),
  cellOrder: z.array(z.string()).default([]),
});
export type NotebookTab = z.infer<typeof NotebookTabSchema>;

export const NotebookSliceConfig = z.object({
  notebook: z.object({
    tabs: z.array(NotebookTabSchema).default([]),
    currentTabId: z.string().optional(),
    cells: z.record(z.string(), NotebookCellSchema).default({}),
  }),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfig>;

export type NotebookSliceState = {
  notebook: {
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
    cellRegistry: Record<
      string,
      {
        title: string;
        createCell: (id: string) => NotebookCell;
        renderComponent: (id: string) => any;
        findDependents: (
          changed: NotebookCell,
          cells: Record<string, NotebookCell>,
        ) => string[];
      }
    >;

    // for extensibility (UI overrides)
    customRenderers: Record<string, (cell: NotebookCell) => any>;
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
>({
  customRenderers = {},
}: {
  customRenderers?: NotebookSliceState['notebook']['customRenderers'];
} = {}) {
  return createSlice<PC, NotebookSliceState>((set, get) => ({
    notebook: {
      customRenderers,

      cellRegistry: {
        sql: {
          title: 'SQL',
          createCell: (id) => ({
            id,
            type: 'sql',
            name: `cell_${id.slice(0, 5)}`,
            sql: '',
            status: 'idle',
            referencedTables: [],
          }),
          renderComponent: (id: string) => {
            const cell = get().config.notebook.cells[id];
            const cr = get().notebook.customRenderers['sql'];
            return cr ? cr(cell!) : React.createElement(SqlCell as any, {id});
          },
          findDependents: (_changed, _cells) => {
            return [];
          },
        },
        text: {
          title: 'Text',
          createCell: (id) => ({id, type: 'text', name: 'Text', text: ''}),
          renderComponent: (id: string) => {
            const cell = get().config.notebook.cells[id];
            const cr = get().notebook.customRenderers['text'];
            return cr ? cr(cell!) : React.createElement(TextCell as any, {id});
          },
          findDependents: () => [],
        },
        markdown: {
          title: 'Markdown',
          createCell: (id) => ({
            id,
            type: 'markdown',
            name: 'Markdown',
            markdown: '',
          }),
          renderComponent: (id: string) => {
            const cell = get().config.notebook.cells[id];
            const cr = get().notebook.customRenderers['markdown'];
            return cr
              ? cr(cell!)
              : React.createElement(MarkdownCell as any, {id});
          },
          findDependents: () => [],
        },
        vega: {
          title: 'Vega',
          createCell: (id) => ({id, type: 'vega', name: 'Chart', sql: ''}),
          renderComponent: (id: string) => {
            const cell = get().config.notebook.cells[id];
            const cr = get().notebook.customRenderers['vega'];
            return cr ? cr(cell!) : React.createElement(VegaCell as any, {id});
          },
          findDependents: () => [],
        },
        input: {
          title: 'Input',
          createCell: (id) => ({
            id,
            type: 'input',
            name: 'Input',
            input: {kind: 'text', varName: 'var', value: ''} as any,
          }),
          renderComponent: (id: string) => {
            const cell = get().config.notebook.cells[id];
            const cr = get().notebook.customRenderers['input'];
            return cr ? cr(cell!) : React.createElement(InputCell as any, {id});
          },
          findDependents: (changed, cells) => {
            if (changed.type !== 'input') return [];
            const varName = changed.input.varName;
            const dependents: string[] = [];
            for (const key in cells) {
              const c = cells[key];
              if (c?.type === 'sql') {
                const text = (c as any).sql as string;
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
            const reg = (get().notebook.cellRegistry as any)[type];
            if (!reg) return;
            const cell = reg.createCell(id) as NotebookCell;
            draft.config.notebook.cells[id] = cell;
            tab.cellOrder.push(id);
          }),
        );
        return id;
      },

      removeCell: (cellId) => {
        set((state) =>
          produce(state, (draft) => {
            delete draft.config.notebook.cells[cellId];
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
            if (cell && 'name' in cell) (cell as any).name = name;
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

        if (cell.type === 'sql') {
          const sqlCell = cell;
          const rawSql = sqlCell.sql || '';

          set((state) =>
            produce(state, (draft) => {
              const c = draft.config.notebook.cells[cellId];
              if (c?.type === 'sql') {
                c.status = 'running';
                c.lastError = undefined;
              }
            }),
          );

          try {
            // Gather input variables and apply simple templating
            const inputs: Extract<NotebookCell, {type: 'input'}>[] = [];
            const cellsMap2 = get().config.notebook.cells;
            for (const key in cellsMap2) {
              const c = cellsMap2[key];
              if (c?.type === 'input') inputs.push(c as any);
            }
            const varMap: Record<string, string | number> = {};
            for (const iv of inputs) {
              varMap[iv.input.varName] = (iv.input as any).value;
            }
            const renderedSql = rawSql
              // {{varName}} style
              .replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, v) => {
                const val = varMap[v];
                return typeof val === 'number'
                  ? String(val)
                  : `'${String(val ?? '')?.replace(/'/g, "''")}'`;
              })
              // :varName style
              .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (_m, v) => {
                const val = varMap[v];
                return typeof val === 'number'
                  ? String(val)
                  : `'${String(val ?? '')?.replace(/'/g, "''")}'`;
              });

            // ensure schema
            const connector = await get().db.getConnector();
            await connector.query(
              `CREATE SCHEMA IF NOT EXISTS ${NOTEBOOK_SCHEMA_NAME}`,
            );

            // validate single select via parser
            const parsed = await get().db.sqlSelectToJson(renderedSql);
            if (parsed.error) {
              throw new Error(
                (parsed as any).error_message || 'Not a valid SELECT statement',
              );
            }

            // basic dependency extraction: referenced base table
            const referenced: string[] = [];
            const stmts = ((parsed as any).statements || []) as any[];
            for (const s of stmts) {
              const from = s?.node?.from_table;
              if (from?.table_name) {
                const schema = from.schema_name || 'main';
                const ref = `${schema}.${from.table_name}`;
                if (referenced.indexOf(ref) < 0) referenced.push(ref);
              }
            }

            const tableName = `${NOTEBOOK_SCHEMA_NAME}.${escapeId(sqlCell.name)}`;
            await connector.query(
              `CREATE OR REPLACE VIEW ${tableName} AS ${renderedSql}`,
            );

            set((state) =>
              produce(state, (draft) => {
                const c = draft.config.notebook.cells[cellId];
                if (c?.type === 'sql') {
                  c.status = 'success';
                  c.outputTable = tableName;
                  c.lastQueryStatement = renderedSql;
                  c.referencedTables = referenced.slice();
                }
              }),
            );

            // cascade: run cells that depend on this cell by referenced tables or variables
            if (opts?.cascade !== false) {
              const cellsMap3 = get().config.notebook.cells;
              for (const key in cellsMap3) {
                const c = cellsMap3[key];
                if (c?.type === 'sql') {
                  const text = (c as any).sql as string;
                  const refs = (c as any).referencedTables as
                    | string[]
                    | undefined;
                  if (
                    (text && text.indexOf(sqlCell.name) >= 0) ||
                    (refs && refs.indexOf(tableName) >= 0)
                  ) {
                    await get().notebook.runCell(c.id, {cascade: false});
                  }
                }
              }
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            set((state) =>
              produce(state, (draft) => {
                const c = draft.config.notebook.cells[cellId];
                if (c?.type === 'sql') {
                  c.status = 'error';
                  c.lastError = message;
                }
              }),
            );
          }
        }
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
