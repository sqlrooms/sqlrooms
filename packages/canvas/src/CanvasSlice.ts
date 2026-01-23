import {createId} from '@paralleldrive/cuid2';
import {
  AiSliceState,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {
  type Cell,
  type CellsRootState,
  type CellsSliceState,
  getSheetsByType,
} from '@sqlrooms/cells';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
import {createVegaChartTool} from '@sqlrooms/vega';
import type {Viewport, XYPosition} from '@xyflow/react';
import {
  applyNodeChanges,
  Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import {NotebookSliceState} from '@sqlrooms/notebook';
import {produce} from 'immer';
import {z} from 'zod';

const DEFAULT_NODE_WIDTH = 800;
const DEFAULT_NODE_HEIGHT = 600;
const CANVAS_SCHEMA_NAME = 'canvas';

/** View metadata for a single node on the canvas */
export const CanvasNodeMeta = z.object({
  id: z.string(),
  position: z.object({x: z.number(), y: z.number()}),
  width: z.number().default(DEFAULT_NODE_WIDTH),
  height: z.number().default(DEFAULT_NODE_HEIGHT),
  data: z.record(z.string(), z.any()).default({}), // Required by ReactFlow NodeBase
});
export type CanvasNodeMeta = z.infer<typeof CanvasNodeMeta>;

/** View metadata for a sheet (canvas view) */
export const CanvasSheetMeta = z.object({
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  nodeOrder: z.array(z.string()).default([]),
});
export type CanvasSheetMeta = z.infer<typeof CanvasSheetMeta>;

export const CanvasSliceConfig = z.object({
  sheets: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        nodes: z.record(z.string(), CanvasNodeMeta).default({}),
        meta: CanvasSheetMeta,
      }),
    )
    .default({}),
});
export type CanvasSliceConfig = z.infer<typeof CanvasSliceConfig>;

export type CanvasSliceState = AiSliceState & {
  canvas: {
    config: CanvasSliceConfig;
    isAssistantOpen: boolean;
    initialize: () => Promise<void>;
    setConfig: (config: CanvasSliceConfig) => void;
    setViewport: (viewport: Viewport) => void;
    setAssistantOpen: (isAssistantOpen: boolean) => void;
    getCanvasSheets: () => Record<string, import('@sqlrooms/cells').Sheet>;

    addNode: (params: {
      sheetId: string;
      nodeType?: string;
      initialPosition?: XYPosition;
      parentId?: string;
    }) => Promise<string>;

    renameNode: (nodeId: string, newTitle: string) => Promise<void>;
    updateNode: (
      nodeId: string,
      updater: (cell: Cell) => Cell,
    ) => Promise<void>;
    deleteNode: (nodeId: string) => void;

    applyNodeChanges: (changes: NodeChange<CanvasNodeMeta>[]) => void;
    applyEdgeChanges: (changes: EdgeChange<any>[]) => void;
    addEdge: (edge: Connection) => void;

    executeSqlNodeQuery: (
      nodeId: string,
      opts?: {cascade?: boolean},
    ) => Promise<void>;
  };
};

function getSheet(config: CanvasSliceConfig, sheetId: string) {
  return config.sheets[sheetId];
}

export function createDefaultCanvasConfig(
  props?: Partial<CanvasSliceConfig>,
): CanvasSliceConfig {
  const base: CanvasSliceConfig = {
    sheets: {},
  };

  return {...base, ...props};
}

export function createCanvasSlice(props: {
  config?: Partial<CanvasSliceConfig>;
  ai?: Partial<Parameters<typeof createAiSlice>[0]>;
}) {
  type CanvasRootState = BaseRoomStoreState &
    DuckDbSliceState &
    CanvasSliceState &
    CellsRootState &
    NotebookSliceState;

  return createSlice<CanvasSliceState, CanvasRootState>((set, get, store) => {
    return {
      ...createAiSlice({
        getInstructions: () => {
          return createDefaultAiInstructions(store);
        },
        tools: {
          ...createDefaultAiTools(store),
          chart: createVegaChartTool(),
          ...props.ai?.tools,
        },
        ...props.ai,
      })(set, get, store),
      canvas: {
        config: createDefaultCanvasConfig(props.config),
        isAssistantOpen: false,
        setConfig: (config: CanvasSliceConfig) => {
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              draft.canvas.config = config;
            }),
          );
        },
        setAssistantOpen: (isAssistantOpen: boolean) => {
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              draft.canvas.isAssistantOpen = isAssistantOpen;
            }),
          );
        },

        getCanvasSheets: () => getSheetsByType(get(), 'canvas'),

        async initialize() {
          const sheetId =
            get().cells.config.currentSheetId ||
            get().cells.config.sheetOrder[0];
          if (!sheetId) return;
          await get().cells.runAllCellsCascade(sheetId);
          await get().db.refreshTableSchemas();
        },

        addNode: async ({
          sheetId,
          nodeType = 'sql',
          initialPosition,
          parentId,
        }: {
          sheetId: string;
          nodeType?: string;
          initialPosition?: XYPosition;
          parentId?: string;
        }) => {
          const newId = createId();
          const registry = get().cells.cellRegistry;
          const reg = registry[nodeType];
          if (!reg) return newId;

          // 1. Create the cell in CellsSlice
          const cell = reg.createCell(newId) as Cell;

          const existingTitles = Object.values(get().cells.config.data).map(
            (c) => (c.data as any).title,
          );
          (cell.data as any).title = generateUniqueName(
            `${reg.title} 1`,
            existingTitles,
            ' ',
          );

          await get().cells.addCell(sheetId, cell);

          // 2. If parent exists, add an edge in CellsSlice
          if (parentId) {
            get().cells.addEdge(sheetId, {source: parentId, target: newId});
          }

          // 3. Update view-specific metadata
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              let sheet = getSheet(draft.canvas.config, sheetId);
              if (!sheet) {
                // Initialize metadata for this sheet if it doesn't exist
                sheet = {
                  id: sheetId,
                  nodes: {},
                  meta: {
                    viewport: {x: 0, y: 0, zoom: 1},
                    nodeOrder: [],
                  },
                };
                draft.canvas.config.sheets[sheetId] = sheet;
              }

              const parentNode = parentId ? sheet.nodes[parentId] : undefined;
              const position: XYPosition = initialPosition
                ? initialPosition
                : parentNode
                  ? {
                      x: parentNode.position.x + parentNode.width + 100,
                      y: parentNode.position.y,
                    }
                  : {
                      x: sheet.meta.viewport.x + 100,
                      y: sheet.meta.viewport.y + 100,
                    };

              sheet.nodes[newId] = {
                id: newId,
                position,
                width: DEFAULT_NODE_WIDTH,
                height: DEFAULT_NODE_HEIGHT,
                data: {},
              };
              sheet.meta.nodeOrder.push(newId);
            }),
          );
          return newId;
        },

        renameNode: async (nodeId: string, newTitle: string) => {
          await get().cells.updateCell(nodeId, (c) =>
            produce(c, (draft) => {
              (draft.data as any).title = newTitle;
            }),
          );
        },

        updateNode: async (nodeId: string, updater: (cell: Cell) => Cell) => {
          await get().cells.updateCell(nodeId, updater);
        },

        deleteNode: (nodeId: string) => {
          get().cells.removeCell(nodeId);
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              for (const sheet of Object.values(draft.canvas.config.sheets)) {
                delete sheet.nodes[nodeId];
                sheet.meta.nodeOrder = sheet.meta.nodeOrder.filter(
                  (id) => id !== nodeId,
                );
              }
            }),
          );
        },

        applyNodeChanges: (changes: NodeChange<CanvasNodeMeta>[]) => {
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              const sheetId = draft.cells.config.currentSheetId;
              if (!sheetId) return;
              let sheet = getSheet(draft.canvas.config, sheetId);
              if (!sheet) {
                // Initialize metadata for this sheet if it doesn't exist
                sheet = {
                  id: sheetId,
                  nodes: {},
                  meta: {
                    viewport: {x: 0, y: 0, zoom: 1},
                    nodeOrder: [],
                  },
                };
                draft.canvas.config.sheets[sheetId] = sheet;
              }

              // Ensure all cells from CellsSlice have a node entry in CanvasSlice
              const cellsSheet = draft.cells.config.sheets[sheetId];
              if (cellsSheet) {
                for (const cellId of cellsSheet.cellIds) {
                  if (!sheet.nodes[cellId]) {
                    sheet.nodes[cellId] = {
                      id: cellId,
                      position: {x: 100, y: 100},
                      width: DEFAULT_NODE_WIDTH,
                      height: DEFAULT_NODE_HEIGHT,
                      data: {},
                    };
                    sheet.meta.nodeOrder.push(cellId);
                  }
                }
              }

              const nodesArray = sheet.meta.nodeOrder
                .map((id) => sheet.nodes[id])
                .filter(Boolean) as CanvasNodeMeta[];
              const updated = applyNodeChanges(changes, nodesArray);
              sheet.nodes = updated.reduce<Record<string, CanvasNodeMeta>>(
                (acc, node) => {
                  acc[node.id] = node;
                  return acc;
                },
                {},
              );
              sheet.meta.nodeOrder = updated.map((n) => n.id);
            }),
          );
        },

        applyEdgeChanges: (changes: EdgeChange<any>[]) => {
          const sheetId = get().cells.config.currentSheetId;
          if (!sheetId) return;

          for (const change of changes) {
            if (change.type === 'remove') {
              get().cells.removeEdge(sheetId, change.id);
            }
          }
        },

        addEdge: (connection: Connection) => {
          const sheetId = get().cells.config.currentSheetId;
          if (sheetId && connection.source && connection.target) {
            get().cells.addEdge(sheetId, {
              source: connection.source,
              target: connection.target,
            });
          }
        },

        setViewport: (viewport: Viewport) => {
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              const sheetId = draft.cells.config.currentSheetId;
              if (!sheetId) return;
              let sheet = getSheet(draft.canvas.config, sheetId);
              if (!sheet) {
                // Initialize metadata if needed
                sheet = {
                  id: sheetId,
                  nodes: {},
                  meta: {
                    viewport,
                    nodeOrder: [],
                  },
                };
                draft.canvas.config.sheets[sheetId] = sheet;
              } else {
                sheet.meta.viewport = viewport;
              }
            }),
          );
        },

        executeSqlNodeQuery: async (
          nodeId: string,
          opts?: {cascade?: boolean},
        ) => {
          await get().cells.runCell(nodeId, {
            ...opts,
            schemaName: CANVAS_SCHEMA_NAME,
          });
        },
      },
    };
  });
}

export type DuckDbSliceStateWithCanvas = DuckDbSliceState &
  CanvasSliceState &
  CellsRootState;

export function useStoreWithCanvas<T>(
  selector: (state: DuckDbSliceStateWithCanvas) => T,
): T {
  return useBaseRoomStore<BaseRoomStoreState, T>((state) =>
    selector(state as unknown as DuckDbSliceStateWithCanvas),
  );
}
