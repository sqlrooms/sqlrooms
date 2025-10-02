import {createId} from '@paralleldrive/cuid2';
import {AiSliceState, createAiSlice} from '@sqlrooms/ai';
import {escapeId} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
  useBaseRoomShellStore,
} from '@sqlrooms/room-shell';
import {createVegaChartTool} from '@sqlrooms/vega';
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
import {findNodeById, topoSortAll, topoSortDownstream} from './dag';

const DEFAULT_NODE_WIDTH = 800;
const DEFAULT_NODE_HEIGHT = 600;
const CANVAS_SCHEMA_NAME = 'canvas';

export const CanvasNodeTypes = z.enum(['sql', 'vega']);
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
    sql: z.string().optional(),
    vegaSpec: z.any().optional(),
  }),
]);
export type CanvasNodeData = z.infer<typeof CanvasNodeData>;

type SqlData = Extract<CanvasNodeData, {type: 'sql'}>;
function isSqlData(data: CanvasNodeData): data is SqlData {
  return data.type === 'sql';
}

function getUniqueSqlTitle(
  nodes: CanvasNodeSchema[],
  baseTitle: string,
  excludeNodeId?: string,
): string {
  const existing = new Set(
    nodes
      .filter((n) => n.type === 'sql' && n.id !== (excludeNodeId || ''))
      .map((n) => n.data.title || ''),
  );
  if (!existing.has(baseTitle)) return baseTitle;
  let counter = 1;
  while (existing.has(`${baseTitle} ${counter}`)) counter += 1;
  return `${baseTitle} ${counter}`;
}

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

export type CanvasSliceState = AiSliceState & {
  canvas: {
    isAssistantOpen: boolean;
    sqlResults: Record<string, SqlNodeQueryResult>;
    initialize: () => Promise<void>;
    setViewport: (viewport: Viewport) => void;
    setAssistantOpen: (isAssistantOpen: boolean) => void;
    addNode: (params: {
      parentId?: string;
      nodeType?: CanvasNodeTypes;
      initialPosition?: XYPosition;
    }) => string;
    executeDownstreamFrom: (nodeId: string) => Promise<void>;
    renameNode: (nodeId: string, newTitle: string) => Promise<void>;
    updateNode: (
      nodeId: string,
      updater: (data: CanvasNodeData) => CanvasNodeData,
    ) => void;
    deleteNode: (nodeId: string) => void;
    applyNodeChanges: (changes: NodeChange<CanvasNodeSchema>[]) => void;
    applyEdgeChanges: (changes: EdgeChange<CanvasEdgeSchema>[]) => void;
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
>(props: Parameters<typeof createAiSlice<PC>>[0]) {
  return createSlice<PC, CanvasSliceState>((set, get, store) => ({
    ...createAiSlice({
      ...props,
      customTools: {
        chart: createVegaChartTool(),
        ...props.customTools,
      },
    })(set, get, store),
    canvas: {
      isAssistantOpen: false,
      sqlResults: {},
      setAssistantOpen: (isAssistantOpen) => {
        set((state) =>
          produce(state, (draft) => {
            draft.canvas.isAssistantOpen = isAssistantOpen;
          }),
        );
      },

      async initialize() {
        // Execute SQL nodes in topological order based on edges
        const nodes = get().config.canvas.nodes;
        const edges = get().config.canvas.edges;

        const order = topoSortAll(nodes, edges);

        // Execute SQL nodes sequentially to ensure parents finish before children
        for (const nodeId of order) {
          const node = findNodeById(get().config.canvas.nodes, nodeId);
          if (!node || !isSqlData(node.data)) continue;
          const sqlText = node.data.sql || '';
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
              ? findNodeById(draft.config.canvas.nodes, parentId)
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

            const getInitialSqlForNewSqlNode = () => {
              if (parent && isSqlData(parent.data)) {
                const parentResults = draft.canvas.sqlResults[parent.id];
                const parentTitle = parent.data.title || 'Query';
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

            const newSqlTitle = getUniqueSqlTitle(
              draft.config.canvas.nodes,
              'Query',
            );
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

      executeDownstreamFrom: async (nodeId: string) => {
        const allNodes = get().config.canvas.nodes;
        const allEdges = get().config.canvas.edges;
        const downstreamOrder = topoSortDownstream(nodeId, allNodes, allEdges);
        for (const childId of downstreamOrder) {
          const child = findNodeById(allNodes, childId);
          if (!child || !isSqlData(child.data)) continue;
          const text = child.data.sql || '';
          if (!text.trim()) continue;
          await get().canvas.executeSqlNodeQuery(childId, {cascade: false});
        }
        await get().db.refreshTableSchemas();
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
            const node = findNodeById(draft.config.canvas.nodes, nodeId);
            if (node) {
              node.data = updater(node.data as CanvasNodeData);
            }
          }),
        );
      },

      renameNode: async (nodeId: string, newTitle: string) => {
        const node = findNodeById(get().config.canvas.nodes, nodeId);
        if (!node) throw new Error('Node not found');
        if (!isSqlData(node.data)) {
          set((state) =>
            produce(state, (draft) => {
              const dnode = findNodeById(draft.config.canvas.nodes, nodeId);
              if (dnode) dnode.data.title = newTitle;
            }),
          );
          return;
        }

        const prevTitle = node.data.title || 'result';
        if (prevTitle === newTitle) return;

        // Ensure title uniqueness among SQL nodes by adjusting to a unique variant
        const uniqueTitle = getUniqueSqlTitle(
          get().config.canvas.nodes,
          newTitle,
          nodeId,
        );

        const connector = await get().db.getConnector();
        await connector.query(
          `CREATE SCHEMA IF NOT EXISTS ${CANVAS_SCHEMA_NAME}`,
        );

        const result = get().canvas.sqlResults[nodeId];
        const oldTableName =
          result && result.status === 'success'
            ? result.tableName
            : `${CANVAS_SCHEMA_NAME}.${escapeId(prevTitle)}`;

        await connector.query(
          `ALTER TABLE ${oldTableName} RENAME TO ${escapeId(uniqueTitle)}`,
        );

        const newQualified = `${CANVAS_SCHEMA_NAME}.${escapeId(uniqueTitle)}`;
        set((state) =>
          produce(state, (draft) => {
            const dnode = findNodeById(draft.config.canvas.nodes, nodeId);
            if (dnode) dnode.data.title = uniqueTitle;
            const r = draft.canvas.sqlResults[nodeId];
            if (r && r.status === 'success') r.tableName = newQualified;
          }),
        );

        await get().db.refreshTableSchemas();

        // Recompute children since upstream table name changed
        await get().canvas.executeDownstreamFrom(nodeId);
      },

      deleteNode: (nodeId) => {
        const current = get();
        const node = findNodeById(current.config.canvas.nodes, nodeId);
        let tableToDrop: string | undefined;
        if (node && isSqlData(node.data)) {
          const title = node.data.title || 'result';
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
            );
          }),
        );
      },

      applyEdgeChanges: (changes) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.canvas.edges = applyEdgeChanges(
              changes,
              draft.config.canvas.edges,
            );
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
        const node = findNodeById(get().config.canvas.nodes, nodeId);
        if (!node || !isSqlData(node.data)) return;
        const sql = node.data.sql || '';
        const title = node.data.title || 'result';

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
            await get().canvas.executeDownstreamFrom(nodeId);
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
