import {createId} from '@paralleldrive/cuid2';
import {
  AiSliceState,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {DagConfig, DagSliceState, createDagSlice} from '@sqlrooms/dag';
import {DuckDbSliceState, escapeId} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
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

export const CanvasDagMetaSchema = z.object({
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  edges: z.array(CanvasEdgeSchema).default([]),
  nodeOrder: z.array(z.string()).default([]),
});
export type CanvasDagMeta = z.infer<typeof CanvasDagMetaSchema>;

export const CanvasSliceConfigSchema = z.object({
  dags: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        cells: z.record(z.string(), CanvasNodeSchema).default({}),
        meta: CanvasDagMetaSchema,
      }),
    )
    .default({}),
  dagOrder: z.array(z.string()).default([]),
  currentDagId: z.string().optional(),
});
export type CanvasSliceConfig = DagConfig<CanvasNodeSchema, CanvasDagMeta>;

export type CanvasSliceState = AiSliceState &
  DagSliceState & {
    canvas: {
      config: CanvasSliceConfig;
      isAssistantOpen: boolean;
      sqlResults: Record<string, SqlNodeQueryResult>;
      initialize: () => Promise<void>;
      setConfig: (config: CanvasSliceConfig) => void;
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

function getDag(config: CanvasSliceConfig, dagId: string) {
  return config.dags[dagId];
}

function ensureCurrentDagId(config: CanvasSliceConfig) {
  return config.currentDagId ?? config.dagOrder[0];
}

function ensureDagExists(config: CanvasSliceConfig): {
  dag: {cells: Record<string, CanvasNodeSchema>; meta: CanvasDagMeta};
  dagId: string;
} {
  let dagId = ensureCurrentDagId(config);
  if (!dagId) {
    dagId = createId();
    config.dagOrder.push(dagId);
  }
  let dag = config.dags[dagId];
  if (!dag) {
    dag = {
      id: dagId,
      cells: {},
      meta: {viewport: {x: 0, y: 0, zoom: 1}, edges: [], nodeOrder: []},
    };
    config.dags[dagId] = dag;
  }
  if (!config.currentDagId) config.currentDagId = dagId;
  return {dag, dagId};
}

function findDagIdByNodeId(config: CanvasSliceConfig, nodeId: string) {
  for (const [dagId, dag] of Object.entries(config.dags)) {
    if (dag?.cells[nodeId]) return dagId;
  }
  return undefined;
}

function dagNodesArray(dag?: {
  cells: Record<string, CanvasNodeSchema>;
  meta: CanvasDagMeta;
}) {
  if (!dag) return [];
  if (dag.meta.nodeOrder.length) {
    return dag.meta.nodeOrder
      .map((id) => dag.cells[id])
      .filter((n): n is CanvasNodeSchema => Boolean(n));
  }
  return Object.values(dag.cells);
}

function normalizeCanvasConfig(
  input: Partial<CanvasSliceConfig> & {
    nodes?: CanvasNodeSchema[];
    edges?: CanvasEdgeSchema[];
    viewport?: {x: number; y: number; zoom: number};
  },
  fallbackDagId?: string,
): CanvasSliceConfig {
  if (input.dags) {
    const dagId =
      input.currentDagId ?? input.dagOrder?.[0] ?? fallbackDagId ?? createId();
    return {
      ...input,
      currentDagId: dagId,
    } as CanvasSliceConfig;
  }

  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  const viewport = input.viewport ?? {x: 0, y: 0, zoom: 1};
  const dagId = fallbackDagId ?? input.currentDagId ?? createId();
  return {
    dags: {
      [dagId]: {
        id: dagId,
        cells: nodes.reduce<Record<string, CanvasNodeSchema>>((acc, n) => {
          acc[n.id] = n;
          return acc;
        }, {}),
        meta: {
          viewport,
          edges,
          nodeOrder: nodes.map((n) => n.id),
        },
      },
    },
    dagOrder: [dagId],
    currentDagId: dagId,
  };
}

export function createDefaultCanvasConfig(
  props?: Partial<CanvasSliceConfig>,
): CanvasSliceConfig {
  const defaultDagId = createId();
  const base: CanvasSliceConfig = {
    dags: {
      [defaultDagId]: {
        id: defaultDagId,
        cells: {},
        meta: {
          viewport: {x: 0, y: 0, zoom: 1},
          edges: [],
          nodeOrder: [],
        },
      },
    },
    dagOrder: [defaultDagId],
    currentDagId: defaultDagId,
  };

  return normalizeCanvasConfig({...base, ...props}, defaultDagId);
}

export function createCanvasSlice(props: {
  config?: Partial<CanvasSliceConfig>;
  ai?: Partial<Parameters<typeof createAiSlice>[0]>;
}) {
  type CanvasRootState = BaseRoomStoreState &
    DuckDbSliceState &
    CanvasSliceState &
    DagSliceState;

  return createSlice<CanvasSliceState & DagSliceState, CanvasRootState>(
    (set, get, store) => {
      const dagSlice = createDagSlice<
        CanvasRootState,
        CanvasNodeSchema,
        CanvasDagMeta
      >({
        getDagConfig: (state) => state.canvas.config,
        findDependencies: ({dagId, cellId, getState}) => {
          const dag = getDag(getState().canvas.config, dagId);
          if (!dag) return [];
          return (dag.meta.edges || [])
            .filter((e) => e.target === cellId)
            .map((e) => e.source);
        },
        runCell: async ({cellId, cascade, getState}) => {
          await getState().canvas.executeSqlNodeQuery(cellId, {cascade});
        },
      })(set as any, get as any, store);

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
        ...dagSlice,
        canvas: {
          config: createDefaultCanvasConfig(props.config),
          isAssistantOpen: false,
          sqlResults: {},
          setConfig: (config: CanvasSliceConfig) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                draft.canvas.config = normalizeCanvasConfig(
                  config as any,
                  draft.canvas.config.currentDagId,
                );
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

          async initialize() {
            const dagId = ensureCurrentDagId(get().canvas.config);
            if (!dagId) return;
            await get().dag.runAllCellsCascade(dagId);
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
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const parentDagId =
                  parentId && findDagIdByNodeId(draft.canvas.config, parentId);
                const {dag, dagId} = parentDagId
                  ? {
                      dag: getDag(draft.canvas.config, parentDagId)!,
                      dagId: parentDagId,
                    }
                  : ensureDagExists(draft.canvas.config);
                if (!dag) return;

                const parent = parentId ? dag.cells[parentId] : undefined;
                const position: XYPosition = initialPosition
                  ? initialPosition
                  : parent
                    ? {
                        x: parent.position.x + parent.width + 100,
                        y: parent.position.y,
                      }
                    : {
                        x: dag.meta.viewport.x + 100,
                        y: dag.meta.viewport.y + 100,
                      };
                const firstTable = draft.db.tables.find(
                  (t: any) => t.table.schema === 'main',
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

                const existingNodes = dagNodesArray(dag);
                const newSqlTitle = getUniqueSqlTitle(existingNodes, 'Query');
                const initialSql = getInitialSqlForNewSqlNode();

                dag.cells[newId] = {
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
                };
                dag.meta.nodeOrder.push(newId);

                if (dag.meta.nodeOrder.length === 1) {
                  draft.canvas.config.currentDagId = dagId;
                }

                if (parentId) {
                  dag.meta.edges.push({
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
            const dagId = findDagIdByNodeId(get().canvas.config, nodeId);
            if (!dagId) return;
            await get().dag.runDownstreamCascade(dagId, nodeId);
            await get().db.refreshTableSchemas();
          },

          addEdge: (connection: Connection) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const sourceDagId =
                  connection.source &&
                  findDagIdByNodeId(draft.canvas.config, connection.source);
                const {dag} = sourceDagId
                  ? {dag: getDag(draft.canvas.config, sourceDagId)!}
                  : ensureDagExists(draft.canvas.config);
                dag.meta.edges = addEdge(connection, dag.meta.edges);
              }),
            );
          },

          updateNode: (
            nodeId: string,
            updater: (data: CanvasNodeData) => CanvasNodeData,
          ) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const dagId = findDagIdByNodeId(draft.canvas.config, nodeId);
                if (!dagId) return;
                const dag = getDag(draft.canvas.config, dagId);
                if (!dag) return;
                const node = dag.cells[nodeId];
                if (node) {
                  node.data = updater(node.data as CanvasNodeData);
                }
              }),
            );
          },

          renameNode: async (nodeId: string, newTitle: string) => {
            const dagId = findDagIdByNodeId(get().canvas.config, nodeId);
            if (!dagId) throw new Error('Node not found');
            const dag = getDag(get().canvas.config, dagId);
            const node = dag?.cells[nodeId];
            if (!node) throw new Error('Node not found');
            if (!isSqlData(node.data)) {
              set((state: CanvasRootState) =>
                produce(state, (draft: CanvasRootState) => {
                  const d = getDag(draft.canvas.config, dagId);
                  const dnode = d?.cells[nodeId];
                  if (dnode) dnode.data.title = newTitle;
                }),
              );
              return;
            }

            const prevTitle = node.data.title || 'result';
            if (prevTitle === newTitle) return;

            const uniqueTitle = getUniqueSqlTitle(
              dagNodesArray(dag),
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
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const d = getDag(draft.canvas.config, dagId);
                const dnode = d?.cells[nodeId];
                if (dnode && isSqlData(dnode.data))
                  dnode.data.title = uniqueTitle;
                const r = draft.canvas.sqlResults[nodeId];
                if (r && r.status === 'success') r.tableName = newQualified;
              }),
            );

            await get().db.refreshTableSchemas();

            await get().dag.runDownstreamCascade(dagId, nodeId);
          },

          deleteNode: (nodeId: string) => {
            const current = get();
            const dagId = findDagIdByNodeId(current.canvas.config, nodeId);
            if (!dagId) return;
            const dag = getDag(current.canvas.config, dagId);
            const node = dag?.cells[nodeId];
            let tableToDrop: string | undefined;
            if (node && isSqlData(node.data)) {
              const title = node.data.title || 'result';
              const res = current.canvas.sqlResults[nodeId];
              tableToDrop =
                res && res.status === 'success'
                  ? res.tableName
                  : `${CANVAS_SCHEMA_NAME}.${escapeId(title)}`;
            }

            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const d = getDag(draft.canvas.config, dagId);
                if (!d) return;
                delete d.cells[nodeId];
                d.meta.nodeOrder = d.meta.nodeOrder.filter(
                  (id) => id !== nodeId,
                );
                d.meta.edges = d.meta.edges.filter(
                  (e) => e.source !== nodeId && e.target !== nodeId,
                );
                delete draft.canvas.sqlResults[nodeId];
                if (Object.keys(d.cells).length === 0) {
                  d.meta.viewport.x = 0;
                  d.meta.viewport.y = 0;
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

          applyNodeChanges: (changes: NodeChange<CanvasNodeSchema>[]) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const {dag} = ensureDagExists(draft.canvas.config);
                const updated = applyNodeChanges(changes, dagNodesArray(dag));
                dag.cells = updated.reduce<Record<string, CanvasNodeSchema>>(
                  (acc, node) => {
                    acc[node.id] = node;
                    return acc;
                  },
                  {},
                );
                dag.meta.nodeOrder = updated.map((n) => n.id);
              }),
            );
          },

          applyEdgeChanges: (changes: EdgeChange<CanvasEdgeSchema>[]) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const {dag} = ensureDagExists(draft.canvas.config);
                dag.meta.edges = applyEdgeChanges(changes, dag.meta.edges);
              }),
            );
          },

          setViewport: (viewport: Viewport) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const {dag} = ensureDagExists(draft.canvas.config);
                const current = dag.meta.viewport;
                if (
                  current.x === viewport.x &&
                  current.y === viewport.y &&
                  current.zoom === viewport.zoom
                ) {
                  return;
                }
                dag.meta.viewport = viewport;
              }),
            );
          },

          executeSqlNodeQuery: async (
            nodeId: string,
            opts?: {cascade?: boolean},
          ) => {
            const dagId = findDagIdByNodeId(get().canvas.config, nodeId);
            if (!dagId) return;
            const dag = getDag(get().canvas.config, dagId);
            const node = dag?.cells[nodeId];
            if (!node || !isSqlData(node.data)) return;
            const sql = node.data.sql || '';
            const title = node.data.title || 'result';

            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                draft.canvas.sqlResults[nodeId] = {status: 'loading'};
              }),
            );

            try {
              const parsed = await get().db.sqlSelectToJson(sql);
              if (parsed.error) {
                throw new Error(
                  parsed.error_message || 'Not a valid SELECT statement',
                );
              }

              const connector = await get().db.getConnector();
              await connector.query(
                `CREATE SCHEMA IF NOT EXISTS ${CANVAS_SCHEMA_NAME}`,
              );

              const tableName = `${CANVAS_SCHEMA_NAME}.${escapeId(title)}`;
              await connector.query(
                `CREATE OR REPLACE TABLE ${tableName} AS ${sql}`,
              );

              set((state: CanvasRootState) =>
                produce(state, (draft: CanvasRootState) => {
                  draft.canvas.sqlResults[nodeId] = {
                    status: 'success',
                    tableName,
                    lastQueryStatement: sql,
                  };
                }),
              );

              if (opts?.cascade !== false) {
                await get().dag.runDownstreamCascade(dagId, nodeId);
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              set((state: CanvasRootState) =>
                produce(state, (draft: CanvasRootState) => {
                  draft.canvas.sqlResults[nodeId] = {
                    status: 'error',
                    error: message,
                  };
                }),
              );
            }
          },
        },
      };
    },
  );
}

export type DuckDbSliceStateWithCanvas = DuckDbSliceState &
  CanvasSliceState &
  DagSliceState;

export function useStoreWithCanvas<T>(
  selector: (state: DuckDbSliceStateWithCanvas) => T,
): T {
  return useBaseRoomStore<BaseRoomStoreState, T>((state) =>
    selector(state as unknown as DuckDbSliceStateWithCanvas),
  );
}
