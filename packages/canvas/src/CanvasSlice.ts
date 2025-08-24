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
import {topoSortAll, topoSortDownstream} from './dag';

const DEFAULT_NODE_WIDTH = 800;
const DEFAULT_NODE_HEIGHT = 600;
const CANVAS_SCHEMA_NAME = 'canvas';

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
    executeSqlNodeQuery: (
      nodeId: string,
      opts?: {cascade?: boolean},
    ) => Promise<void>;
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

        const order = topoSortAll(nodes, edges);

        // Execute SQL nodes sequentially to ensure parents finish before children
        for (const nodeId of order) {
          const node = get().config.canvas.nodes.find((n) => n.id === nodeId);
          if (!node || node.type !== 'sql') continue;
          const sqlText = ((node.data as any)?.sql as string) || '';
          if (!sqlText.trim()) continue;
          // Await ensures table creation completes before children execute
          await get().canvas.executeSqlNodeQuery(nodeId, {cascade: false});
        }

        await get().db.refreshTableSchemas();
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
        const current = get();
        const node = current.config.canvas.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const isSqlNode = node.type === 'sql';
        const prevData = node.data as CanvasNodeData;
        const nextData = updater(prevData) as CanvasNodeData;
        const prevTitle = isSqlNode
          ? ((prevData as any).title as string)
          : undefined;
        const nextTitle = isSqlNode
          ? ((nextData as any).title as string)
          : undefined;
        const titleChanged =
          isSqlNode && prevTitle !== nextTitle && !!prevTitle && !!nextTitle;

        // Apply the data update
        set((state) =>
          produce(state, (draft) => {
            const dnode = draft.config.canvas.nodes.find(
              (n) => n.id === nodeId,
            );
            if (dnode) {
              dnode.data = nextData as any;
            }
          }),
        );

        // If SQL node title changed and there is/was a table, attempt to rename it
        if (titleChanged) {
          (async () => {
            try {
              const result = get().canvas.sqlResults[nodeId];
              const connector = await get().db.getConnector();
              await connector.query(
                `CREATE SCHEMA IF NOT EXISTS ${CANVAS_SCHEMA_NAME}`,
              );
              const oldTableName =
                result && result.status === 'success'
                  ? result.tableName
                  : `${CANVAS_SCHEMA_NAME}.${escapeId(prevTitle as string)}`;
              const newTableName = `${CANVAS_SCHEMA_NAME}.${escapeId(nextTitle as string)}`;

              // If a table with the new name exists, drop it to avoid rename conflicts
              await connector.query(`DROP TABLE IF EXISTS ${newTableName}`);
              // Rename uses only the table identifier, not qualified schema, in DuckDB
              await connector.query(
                `ALTER TABLE ${oldTableName} RENAME TO ${escapeId(nextTitle as string)}`,
              );

              // Update stored result table name if present
              set((state) =>
                produce(state, (draft) => {
                  const r = draft.canvas.sqlResults[nodeId];
                  if (r && r.status === 'success') {
                    r.tableName = newTableName;
                  }
                }),
              );
              await get().db.refreshTableSchemas();
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn(
                '[canvas.updateNode] Failed to rename table for node',
                nodeId,
                e,
              );
            }
          })();
        }
      },

      deleteNode: (nodeId) => {
        const current = get();
        const node = current.config.canvas.nodes.find((n) => n.id === nodeId);
        let tableToDrop: string | undefined;
        if (node && node.type === 'sql') {
          const title = ((node.data as any).title as string) || 'result';
          const res = current.canvas.sqlResults[nodeId];
          tableToDrop =
            res && res.status === 'success'
              ? res.tableName
              : `${CANVAS_SCHEMA_NAME}.${escapeId(title)}`;
        }

        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.nodes = draft.config.canvas.nodes.filter(
              (n) => n.id !== nodeId,
            );
            draft.config.canvas.edges = draft.config.canvas.edges.filter(
              (e) => e.source !== nodeId && e.target !== nodeId,
            );
            // Clear stored result for the node
            delete draft.canvas.sqlResults[nodeId];
            if (draft.config.canvas.nodes.length === 0) {
              draft.config.canvas.viewport.x = 0;
              draft.config.canvas.viewport.y = 0;
            }
          }),
        );

        if (tableToDrop) {
          (async () => {
            try {
              const connector = await get().db.getConnector();
              await connector.query(`DROP TABLE IF EXISTS ${tableToDrop}`);
              await get().db.refreshTableSchemas();
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn(
                '[canvas.deleteNode] Failed to drop table for node',
                nodeId,
                e,
              );
            }
          })();
        }
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

      executeSqlNodeQuery: async (
        nodeId: string,
        opts?: {cascade?: boolean},
      ) => {
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
            throw new Error(
              parsed.error_message || 'Not a valid SELECT statement',
            );
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

          // Cascade execution to downstream SQL nodes (topologically) unless disabled
          if (opts?.cascade !== false) {
            const allNodes = get().config.canvas.nodes;
            const allEdges = get().config.canvas.edges;
            const downstreamOrder = topoSortDownstream(
              nodeId,
              allNodes,
              allEdges,
            );
            for (const childId of downstreamOrder) {
              const child = allNodes.find((n) => n.id === childId);
              if (!child || child.type !== 'sql') continue;
              const text = ((child.data as any)?.sql as string) || '';
              if (!text.trim()) continue;
              await get().canvas.executeSqlNodeQuery(childId, {cascade: false});
            }

            await get().db.refreshTableSchemas();
          }
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
