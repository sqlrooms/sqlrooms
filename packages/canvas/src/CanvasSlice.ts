import {createId} from '@paralleldrive/cuid2';
import {escapeId} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
  useBaseRoomShellStore,
} from '@sqlrooms/room-shell';
import type {Viewport, XYPosition} from '@xyflow/react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import {produce} from 'immer';
import {z} from 'zod';

const DEFAULT_NODE_WIDTH = 800;
const DEFAULT_NODE_HEIGHT = 600;
const CANVAS_SCHEMA_NAME = '__canvas';

export const CanvasNodeTypes = z.enum(['sql', 'vega'] as const);
export type CanvasNodeTypes = z.infer<typeof CanvasNodeTypes>;

export const CanvasNodeData = z.discriminatedUnion('type', [
  z.object({
    title: z.string().default('Untitled'),
    type: z.literal('sql'),
    sql: z.string().optional(),
  }),
  z.object({
    title: z.string().default('Untitled'),
    type: z.literal('vega'),
    vegaSpec: z.any().optional(),
  }),
]);
export type CanvasNodeData = z.infer<typeof CanvasNodeData>;

export const CanvasNodeSchema = z.object({
  id: z.string(),
  position: z.object({x: z.number(), y: z.number()}),
  type: CanvasNodeTypes,
  data: CanvasNodeData,
  width: z.number(),
  height: z.number(),
});
export type CanvasNodeSchema = z.infer<typeof CanvasNodeSchema>;

export const CanvasEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});
export type CanvasEdgeSchema = z.infer<typeof CanvasEdgeSchema>;

export type SqlNodeQueryResult =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'error'; error: string}
  | {status: 'success'; tableName: string; lastQueryStatement: string};

export const CanvasSliceConfig = z.object({
  canvas: z.object({
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }),
    nodes: z.array(CanvasNodeSchema).default([]),
    edges: z.array(CanvasEdgeSchema).default([]),
  }),
});
export type CanvasSliceConfig = z.infer<typeof CanvasSliceConfig>;

export type CanvasSliceState = {
  canvas: {
    sqlResults: Record<string, SqlNodeQueryResult>;
    initialize: () => Promise<void>;
    setViewport: (viewport: Viewport) => void;
    addNode: (params: {
      parentId?: string;
      nodeType?: CanvasNodeTypes;
      initialPosition?: XYPosition;
    }) => string;
    updateNode: (
      nodeId: string,
      updater: (data: CanvasNodeData) => CanvasNodeData,
    ) => void;
    deleteNode: (nodeId: string) => void;
    applyNodeChanges: (changes: NodeChange[]) => void;
    applyEdgeChanges: (changes: EdgeChange[]) => void;
    addEdge: (edge: Connection) => void;
    executeSqlNodeQuery: (nodeId: string) => Promise<void>;
  };
};

export function createDefaultCanvasConfig(
  props: Partial<CanvasSliceConfig['canvas']> = {},
): CanvasSliceConfig {
  return {
    canvas: {
      viewport: {x: 0, y: 0, zoom: 1},
      nodes: [],
      edges: [],
      ...props,
    },
  };
}

export function createCanvasSlice<
  PC extends BaseRoomConfig & CanvasSliceConfig,
>() {
  return createSlice<PC, CanvasSliceState>((set, get) => ({
    canvas: {
      sqlResults: {},

      async initialize() {
        // Execute SQL nodes in topological order based on edges
        const nodes = get().config.canvas.nodes;
        const edges = get().config.canvas.edges;

        // Build adjacency list and indegree map for all nodes
        const adjacency: Record<string, string[]> = {};
        const inDegree: Record<string, number> = {};

        for (const node of nodes) {
          adjacency[node.id] = [];
          inDegree[node.id] = 0;
        }

        for (const edge of edges) {
          adjacency[edge.source] = adjacency[edge.source] ?? [];
          adjacency[edge.source].push(edge.target);
          inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1;
        }

        // Kahn's algorithm for topological sort
        const queue: string[] = Object.keys(inDegree).filter(
          (id) => inDegree[id] === 0,
        );
        const order: string[] = [];

        while (queue.length > 0) {
          const current = queue.shift() as string;
          order.push(current);
          const neighbors = adjacency[current] || [];
          for (const neighbor of neighbors) {
            inDegree[neighbor] = (inDegree[neighbor] ?? 0) - 1;
            if (inDegree[neighbor] === 0) {
              queue.push(neighbor);
            }
          }
        }

        // If there's a cycle, append remaining nodes in their current config order
        if (order.length < nodes.length) {
          const remaining = nodes
            .map((n) => n.id)
            .filter((id) => !order.includes(id));
          // eslint-disable-next-line no-console
          console.warn(
            '[canvas.initialize] Cycle detected in graph. Execution order may be invalid for nodes:',
            remaining,
          );
          order.push(...remaining);
        }

        // Execute SQL nodes sequentially to ensure parents finish before children
        for (const nodeId of order) {
          const node = get().config.canvas.nodes.find((n) => n.id === nodeId);
          if (!node || node.type !== 'sql') continue;
          const sqlText = ((node.data as any)?.sql as string) || '';
          if (!sqlText.trim()) continue;
          // Await ensures table creation completes before children execute
          await get().canvas.executeSqlNodeQuery(nodeId);
        }
      },

      addNode: ({
        parentId,
        nodeType = 'sql',
        initialPosition,
      }: {
        parentId?: string;
        nodeType?: CanvasNodeTypes;
        initialPosition?: XYPosition;
      }) => {
        const newId = createId();
        set((state) =>
          produce(state, (draft) => {
            const parent = parentId
              ? draft.config.canvas.nodes.find((n) => n.id === parentId)
              : undefined;
            const position: XYPosition = initialPosition
              ? initialPosition
              : parent
                ? {
                    x: parent.position.x + parent.width + 100,
                    y: parent.position.y,
                  }
                : {
                    x: draft.config.canvas.viewport.x + 100,
                    y: draft.config.canvas.viewport.y + 100,
                  };
            const firstTable = draft.db.tables.find(
              (t) => t.table.schema === 'main',
            );

            const getUniqueQueryTitle = () => {
              const baseTitle = 'Query';
              const existing = new Set(
                draft.config.canvas.nodes
                  .filter((n) => n.type === 'sql')
                  .map((n) => (n.data as any).title as string),
              );
              if (!existing.has(baseTitle)) return baseTitle;
              let counter = 1;
              while (existing.has(`${baseTitle} ${counter}`)) counter += 1;
              return `${baseTitle} ${counter}`;
            };

            const getInitialSqlForNewSqlNode = () => {
              if (parent && parent.type === 'sql') {
                const parentResults = draft.canvas.sqlResults[parent.id];
                const parentTitle = (parent.data as any).title || 'Query';
                const fallbackParentTable = `${CANVAS_SCHEMA_NAME}.${escapeId(parentTitle)}`;
                const parentTableName =
                  parentResults && parentResults.status === 'success'
                    ? parentResults.tableName
                    : fallbackParentTable;
                return `SELECT * FROM ${parentTableName}`;
              }
              return firstTable
                ? `SELECT * FROM ${firstTable.table.table}`
                : `SELECT 1`;
            };

            const newSqlTitle = getUniqueQueryTitle();
            const initialSql = getInitialSqlForNewSqlNode();

            draft.config.canvas.nodes.push({
              id: newId,
              position,
              width: DEFAULT_NODE_WIDTH,
              height: DEFAULT_NODE_HEIGHT,
              type: nodeType,
              data: (nodeType === 'sql'
                ? {
                    title: newSqlTitle,
                    type: 'sql',
                    sql: initialSql,
                  }
                : {
                    title: 'Chart',
                    type: 'vega',
                    vegaSpec: {
                      description: 'A simple bar chart',
                      mark: 'bar',
                      encoding: {
                        x: {field: 'category', type: 'ordinal'},
                        y: {field: 'value', type: 'quantitative'},
                      },
                      data: {
                        values: [
                          {category: 'A', value: 28},
                          {category: 'B', value: 55},
                          {category: 'C', value: 43},
                        ],
                      },
                    },
                  }) as CanvasNodeData,
            });
            if (parentId) {
              draft.config.canvas.edges.push({
                id: `${parentId}-${newId}`,
                source: parentId,
                target: newId,
              });
            }
          }),
        );
        return newId;
      },

      addEdge: (connection) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.edges = addEdge(
              connection,
              draft.config.canvas.edges,
            );
          }),
        );
      },

      updateNode: (nodeId, updater) => {
        set((state) =>
          produce(state, (draft) => {
            const node = draft.config.canvas.nodes.find((n) => n.id === nodeId);
            if (node) {
              node.data = updater(node.data as CanvasNodeData) as any;
            }
          }),
        );
      },

      deleteNode: (nodeId) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.nodes = draft.config.canvas.nodes.filter(
              (n) => n.id !== nodeId,
            );
            draft.config.canvas.edges = draft.config.canvas.edges.filter(
              (e) => e.source !== nodeId && e.target !== nodeId,
            );
            if (draft.config.canvas.nodes.length === 0) {
              draft.config.canvas.viewport.x = 0;
              draft.config.canvas.viewport.y = 0;
            }
          }),
        );
      },

      applyNodeChanges: (changes) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.nodes = applyNodeChanges(
              changes,
              draft.config.canvas.nodes,
            ) as any;
          }),
        );
      },

      applyEdgeChanges: (changes) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.edges = applyEdgeChanges(
              changes,
              draft.config.canvas.edges,
            ) as any;
          }),
        );
      },

      setViewport: (viewport) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.viewport = viewport;
          }),
        );
      },

      executeSqlNodeQuery: async (nodeId: string) => {
        console.log('executeSqlNodeQuery', nodeId);
        const node = get().config.canvas.nodes.find((n) => n.id === nodeId);
        if (!node || node.type !== 'sql') return;
        const sqlNode = node.data as Extract<CanvasNodeData, {type: 'sql'}>;
        const sql = sqlNode.sql || '';
        const title = sqlNode.title || 'result';

        set((state) =>
          produce(state, (draft) => {
            draft.canvas.sqlResults[nodeId] = {status: 'loading'};
          }),
        );

        try {
          // Validate it's a single select
          const parsed = await get().db.sqlSelectToJson(sql);
          if (parsed.error) {
            throw new Error('Not a SELECT statement');
          }

          // Create schema and table
          const connector = await get().db.getConnector();
          await connector.query(
            `CREATE SCHEMA IF NOT EXISTS ${CANVAS_SCHEMA_NAME}`,
          );

          const tableName = `${CANVAS_SCHEMA_NAME}.${escapeId(title)}`;
          await connector.query(
            `CREATE OR REPLACE TABLE ${tableName} AS ${sql}`,
          );

          set((state) =>
            produce(state, (draft) => {
              draft.canvas.sqlResults[nodeId] = {
                status: 'success',
                tableName,
                lastQueryStatement: sql,
              };
            }),
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          set((state) =>
            produce(state, (draft) => {
              draft.canvas.sqlResults[nodeId] = {
                status: 'error',
                error: message,
              };
            }),
          );
        }
      },
    },
  }));
}

// Types to integrate with room-shell selector
export type RoomConfigWithCanvas = BaseRoomConfig & CanvasSliceConfig;
export type RoomShellSliceStateWithCanvas =
  RoomShellSliceState<RoomConfigWithCanvas> & CanvasSliceState;

export function useStoreWithCanvas<T>(
  selector: (state: RoomShellSliceStateWithCanvas) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & CanvasSliceConfig,
    RoomShellSliceState<RoomConfigWithCanvas>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithCanvas));
}
