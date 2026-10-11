import {createId} from '@paralleldrive/cuid2';
import {type Cell, type CellsRootState} from '@sqlrooms/cells';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import type {Viewport, XYPosition} from '@xyflow/react';
import {
  applyNodeChanges,
  Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import {produce} from 'immer';
import {z} from 'zod';

const DEFAULT_NODE_WIDTH = 800;
const DEFAULT_NODE_HEIGHT = 600;
const CANVAS_SCHEMA_NAME = 'canvas';
const VIEWPORT_EPSILON = 0.1;

/** View metadata for a single node on the canvas */
export const CanvasNodeMeta = z.object({
  id: z.string(),
  position: z.object({x: z.number(), y: z.number()}),
  width: z.number().default(DEFAULT_NODE_WIDTH),
  height: z.number().default(DEFAULT_NODE_HEIGHT),
  data: z.record(z.string(), z.any()).default({}), // Required by ReactFlow NodeBase
});
export type CanvasNodeMeta = z.infer<typeof CanvasNodeMeta>;

/** View metadata for a canvas artifact. */
export const CanvasArtifactMeta = z.object({
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  nodeOrder: z.array(z.string()).default([]),
});
export type CanvasArtifactMeta = z.infer<typeof CanvasArtifactMeta>;

const CanvasArtifactRuntime = z.object({
  id: z.string(),
  nodes: z.record(z.string(), CanvasNodeMeta).default({}),
  meta: CanvasArtifactMeta,
});

export const CanvasSliceConfig = z.object({
  artifacts: z.record(z.string(), CanvasArtifactRuntime).default({}),
});
export type CanvasSliceConfig = z.infer<typeof CanvasSliceConfig>;

export type CanvasSliceState = {
  canvas: {
    config: CanvasSliceConfig;
    initialize: () => Promise<void>;
    setConfig: (config: CanvasSliceConfig) => void;
    ensureArtifact: (artifactId: string) => void;
    removeArtifact: (artifactId: string) => void;
    setViewport: (artifactId: string, viewport: Viewport) => void;

    addNode: (params: {
      artifactId: string;
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

    applyNodeChanges: (
      artifactId: string,
      changes: NodeChange<CanvasNodeMeta>[],
    ) => void;
    applyEdgeChanges: (changes: EdgeChange<any>[]) => void;
    addEdge: (edge: Connection) => void;

    executeSqlNodeQuery: (
      nodeId: string,
      opts?: {cascade?: boolean},
    ) => Promise<void>;
  };
};

function getArtifact(config: CanvasSliceConfig, artifactId: string) {
  return config.artifacts[artifactId];
}

function ensureCanvasArtifactMeta(
  config: CanvasSliceConfig,
  artifactId: string,
  viewport: Viewport = {x: 0, y: 0, zoom: 1},
) {
  let artifact = config.artifacts[artifactId];
  if (!artifact) {
    artifact = {
      id: artifactId,
      nodes: {},
      meta: {
        viewport,
        nodeOrder: [],
      },
    };
    config.artifacts[artifactId] = artifact;
  }
  return artifact;
}

function isSameViewport(a: Viewport, b: Viewport) {
  return (
    Math.abs(a.x - b.x) < VIEWPORT_EPSILON &&
    Math.abs(a.y - b.y) < VIEWPORT_EPSILON &&
    Math.abs(a.zoom - b.zoom) < VIEWPORT_EPSILON
  );
}

export function createDefaultCanvasConfig(
  props?: Partial<CanvasSliceConfig>,
): CanvasSliceConfig {
  const base: CanvasSliceConfig = {
    artifacts: {},
  };

  return {...base, ...props};
}

export function createCanvasSlice(
  props: {config?: Partial<CanvasSliceConfig>} = {},
) {
  type CanvasRootState = BaseRoomStoreState &
    DuckDbSliceState &
    CanvasSliceState &
    CellsRootState;

  return createSlice<CanvasSliceState, CanvasRootState>((set, get, store) => {
    return {
      canvas: {
        config: createDefaultCanvasConfig(props.config),
        setConfig: (config: CanvasSliceConfig) => {
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              draft.canvas.config = config;
            }),
          );
        },

        ensureArtifact: (artifactId) => {
          get().cells.ensureArtifact(artifactId);
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              ensureCanvasArtifactMeta(draft.canvas.config, artifactId);
            }),
          );
        },

        removeArtifact: (artifactId) => {
          get().cells.removeArtifact(artifactId);
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              delete draft.canvas.config.artifacts[artifactId];
            }),
          );
        },

        async initialize() {
          // no-op: host apps should call artifact-scoped runtime explicitly
        },

        addNode: async ({
          artifactId,
          nodeType = 'sql',
          initialPosition,
          parentId,
        }: {
          artifactId: string;
          nodeType?: string;
          initialPosition?: XYPosition;
          parentId?: string;
        }) => {
          const newId = createId();
          const registry = get().cells.cellRegistry;
          const reg = registry[nodeType];
          if (!reg) return newId;

          // 1. Create the cell in CellsSlice
          const cell = reg.createCell({id: newId, get, set}) as Cell;

          const existingTitles = Object.values(get().cells.config.data).map(
            (c) => {
              const title = (c.data as Record<string, unknown>).title;
              return typeof title === 'string' ? title : '';
            },
          );
          (cell.data as Record<string, unknown>).title = generateUniqueName(
            `${reg.title} 1`,
            existingTitles,
            ' ',
          );

          get().cells.ensureArtifact(artifactId);
          await get().cells.addCell(artifactId, cell);

          // 2. If parent exists, add an edge in CellsSlice
          if (parentId) {
            get().cells.addEdge(artifactId, {source: parentId, target: newId});
          }

          // 3. Update view-specific metadata
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              let artifact = getArtifact(draft.canvas.config, artifactId);
              artifact = ensureCanvasArtifactMeta(
                draft.canvas.config,
                artifactId,
              );

              const parentNode = parentId
                ? artifact.nodes[parentId]
                : undefined;
              const position: XYPosition = initialPosition
                ? initialPosition
                : parentNode
                  ? {
                      x: parentNode.position.x + parentNode.width + 100,
                      y: parentNode.position.y,
                    }
                  : {
                      x: artifact.meta.viewport.x + 100,
                      y: artifact.meta.viewport.y + 100,
                    };

              artifact.nodes[newId] = {
                id: newId,
                position,
                width: DEFAULT_NODE_WIDTH,
                height: DEFAULT_NODE_HEIGHT,
                data: {},
              };
              artifact.meta.nodeOrder.push(newId);
            }),
          );
          return newId;
        },

        renameNode: async (nodeId: string, newTitle: string) => {
          await get().cells.updateCell(nodeId, (c) =>
            produce(c, (draft) => {
              (draft.data as Record<string, unknown>).title = newTitle;
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
              for (const artifact of Object.values(
                draft.canvas.config.artifacts,
              )) {
                delete artifact.nodes[nodeId];
                artifact.meta.nodeOrder = artifact.meta.nodeOrder.filter(
                  (id) => id !== nodeId,
                );
              }
            }),
          );
        },

        applyNodeChanges: (
          artifactId: string,
          changes: NodeChange<CanvasNodeMeta>[],
        ) => {
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              const artifact = ensureCanvasArtifactMeta(
                draft.canvas.config,
                artifactId,
              );

              // Ensure all cells from CellsSlice have a node entry in CanvasSlice
              const cellsArtifact = draft.cells.config.artifacts[artifactId];
              if (cellsArtifact) {
                for (const cellId of cellsArtifact.cellIds) {
                  if (!artifact.nodes[cellId]) {
                    artifact.nodes[cellId] = {
                      id: cellId,
                      position: {x: 100, y: 100},
                      width: DEFAULT_NODE_WIDTH,
                      height: DEFAULT_NODE_HEIGHT,
                      data: {},
                    };
                    artifact.meta.nodeOrder.push(cellId);
                  }
                }
              }

              const nodesArray = artifact.meta.nodeOrder
                .map((id) => artifact.nodes[id])
                .filter(Boolean) as CanvasNodeMeta[];
              const updated = applyNodeChanges(changes, nodesArray);
              artifact.nodes = updated.reduce<Record<string, CanvasNodeMeta>>(
                (acc, node) => {
                  acc[node.id] = node;
                  return acc;
                },
                {},
              );
              artifact.meta.nodeOrder = updated.map((n) => n.id);
            }),
          );
        },

        applyEdgeChanges: (changes: EdgeChange<any>[]) => {
          // Canvas edge editing is intentionally disabled for now.
          // Compatibility no-op: keep API stable until edge kinds are introduced.
          void changes;
        },

        addEdge: (connection: Connection) => {
          // Canvas edge editing is intentionally disabled for now.
          // Compatibility no-op: dependency edges are derived from graph cache.
          void connection;
        },

        setViewport: (artifactId: string, viewport: Viewport) => {
          const existing = get().canvas.config.artifacts[artifactId];
          if (existing && isSameViewport(existing.meta.viewport, viewport)) {
            return;
          }
          set((state: CanvasRootState) =>
            produce(state, (draft: CanvasRootState) => {
              let artifact = getArtifact(draft.canvas.config, artifactId);
              artifact = ensureCanvasArtifactMeta(
                draft.canvas.config,
                artifactId,
                viewport,
              );
              artifact.meta.viewport = viewport;
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
