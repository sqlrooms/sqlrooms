import {createId} from '@paralleldrive/cuid2';
import {
  AiSliceState,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {
  createDagSlice,
  ensureDag,
  type Cell,
  type CellsRootState,
  type DagConfig,
  type DagSliceState,
} from '@sqlrooms/cells';
import {DuckDbSliceState, escapeId} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
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
import {NotebookSliceState} from '@sqlrooms/notebook';
import {produce} from 'immer';
import {z} from 'zod';

const DEFAULT_NODE_WIDTH = 800;
const DEFAULT_NODE_HEIGHT = 600;
const CANVAS_SCHEMA_NAME = 'canvas';

export const CanvasNodeTypes = z.enum(['sql', 'vega']);
export type CanvasNodeTypes = z.infer<typeof CanvasNodeTypes>;

export const CanvasNode = z.object({
  id: z.string(),
  position: z.object({x: z.number(), y: z.number()}),
  width: z.number().default(DEFAULT_NODE_WIDTH),
  height: z.number().default(DEFAULT_NODE_HEIGHT),
  data: z.record(z.string(), z.any()).default({}),
});
export type CanvasNode = z.infer<typeof CanvasNode>;

export const CanvasEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});
export type CanvasEdge = z.infer<typeof CanvasEdge>;

export const CanvasDagMeta = z.object({
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  edges: z.array(CanvasEdge).default([]),
  nodeOrder: z.array(z.string()).default([]),
});
export type CanvasDagMeta = z.infer<typeof CanvasDagMeta>;

export const CanvasSliceConfig = z.object({
  dags: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        cells: z.record(z.string(), CanvasNode).default({}),
        meta: CanvasDagMeta,
      }),
    )
    .default({}),
  dagOrder: z.array(z.string()).default([]),
  currentDagId: z.string().optional(),
}) satisfies z.ZodType<DagConfig<CanvasNode, CanvasDagMeta>>;
export type CanvasSliceConfig = z.infer<typeof CanvasSliceConfig>;

export type CanvasSliceState = AiSliceState &
  DagSliceState & {
    canvas: {
      config: CanvasSliceConfig;
      isAssistantOpen: boolean;
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
      updateNode: (nodeId: string, updater: (cell: Cell) => Cell) => void;
      deleteNode: (nodeId: string) => void;
      applyNodeChanges: (changes: NodeChange<CanvasNode>[]) => void;
      applyEdgeChanges: (changes: EdgeChange<CanvasEdge>[]) => void;
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

function ensureDagExists(config: CanvasSliceConfig) {
  return ensureDag(config, () => ({
    viewport: {x: 0, y: 0, zoom: 1},
    edges: [],
    nodeOrder: [],
  }));
}

function findDagIdByNodeId(config: CanvasSliceConfig, nodeId: string) {
  for (const [dagId, dag] of Object.entries(config.dags)) {
    if (dag?.cells[nodeId]) return dagId;
  }
  return undefined;
}

function dagNodesArray(dag?: {
  cells: Record<string, CanvasNode>;
  meta: CanvasDagMeta;
}) {
  if (!dag) return [];
  if (dag.meta.nodeOrder.length) {
    return dag.meta.nodeOrder
      .map((id) => dag.cells[id])
      .filter((n): n is CanvasNode => Boolean(n));
  }
  return Object.values(dag.cells);
}

function normalizeCanvasConfig(
  input: Partial<CanvasSliceConfig> & {
    nodes?: CanvasNode[];
    edges?: CanvasEdge[];
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
        cells: nodes.reduce<Record<string, CanvasNode>>((acc, n) => {
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
    DagSliceState &
    CellsRootState &
    NotebookSliceState;

  return createSlice<CanvasSliceState & DagSliceState, CanvasRootState>(
    (set, get, store) => {
      const dagSlice = createDagSlice<
        CanvasRootState,
        CanvasNode,
        CanvasDagMeta
      >({
        getDagConfig: (state) => {
          return state.canvas.config;
        },
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
                const parentCell = parentId
                  ? draft.cells.data[parentId]
                  : undefined;

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
                  if (parentCell && parentCell.type === 'sql') {
                    const status = draft.cells.status[parentCell.id];
                    const parentTitle = parentCell.data.title || 'Query';
                    const fallbackParentTable = `${CANVAS_SCHEMA_NAME}.${escapeId(parentTitle)}`;
                    const parentTableName =
                      status?.type === 'sql' && status.status === 'success'
                        ? status.resultName
                        : fallbackParentTable;
                    return `SELECT * FROM ${parentTableName}`;
                  }
                  return firstTable
                    ? `SELECT * FROM ${firstTable.table.table}`
                    : `SELECT 1`;
                };

                const existingTitles = Object.values(draft.cells.data).map(
                  (c) => (c.data as any).title,
                );
                const newSqlTitle = generateUniqueName('Query', existingTitles);
                const initialSql = getInitialSqlForNewSqlNode();

                const cell: Cell =
                  nodeType === 'sql'
                    ? {
                        id: newId,
                        type: 'sql',
                        data: {title: newSqlTitle, sql: initialSql},
                      }
                    : {id: newId, type: 'vega', data: {title: 'Chart'}};

                draft.cells.data[newId] = cell;
                if (cell.type === 'sql') {
                  draft.cells.status[newId] = {
                    type: 'sql',
                    status: 'idle',
                    referencedTables: [],
                  };
                } else {
                  draft.cells.status[newId] = {type: 'other'};
                }

                // NEW: Also add to notebook current tab if it exists
                if (draft.notebook?.config?.currentDagId) {
                  const nbDag =
                    draft.notebook.config.dags[
                      draft.notebook.config.currentDagId
                    ];
                  if (nbDag) {
                    nbDag.meta.cellOrder.push(newId);
                    if (cell.type === ('input' as any)) {
                      nbDag.meta.inputBarOrder.push(newId);
                    }
                  }
                }

                dag.cells[newId] = {
                  id: newId,
                  position,
                  width: DEFAULT_NODE_WIDTH,
                  height: DEFAULT_NODE_HEIGHT,
                  data: {},
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

          updateNode: (nodeId: string, updater: (cell: Cell) => Cell) => {
            get().cells.updateCell(nodeId, updater);
          },

          renameNode: async (nodeId: string, newTitle: string) => {
            const cell = get().cells.data[nodeId];
            if (!cell) throw new Error('Node not found');

            if (cell.type !== 'sql') {
              get().cells.updateCell(nodeId, (c) =>
                produce(c, (draft) => {
                  (draft.data as any).title = newTitle;
                }),
              );
              return;
            }

            const prevTitle = cell.data.title || 'result';
            if (prevTitle === newTitle) return;

            const existingTitles = Object.values(get().cells.data).map(
              (c) => (c.data as any).title,
            );
            const uniqueTitle = generateUniqueName(newTitle, existingTitles);

            const connector = await get().db.getConnector();
            await connector.query(
              `CREATE SCHEMA IF NOT EXISTS ${CANVAS_SCHEMA_NAME}`,
            );

            const status = get().cells.status[nodeId];
            const oldTableName =
              status?.type === 'sql' && status.status === 'success'
                ? status.resultName
                : `${CANVAS_SCHEMA_NAME}.${escapeId(prevTitle)}`;

            await connector.query(
              `ALTER TABLE ${oldTableName} RENAME TO ${escapeId(uniqueTitle)}`,
            );

            const newQualified = `${CANVAS_SCHEMA_NAME}.${escapeId(uniqueTitle)}`;

            get().cells.updateCell(nodeId, (c) =>
              produce(c, (draft) => {
                if (draft.type === 'sql') draft.data.title = uniqueTitle;
              }),
            );

            set((s) =>
              produce(s, (draft) => {
                const st = draft.cells.status[nodeId];
                if (st?.type === 'sql' && st.status === 'success') {
                  st.resultName = newQualified;
                  st.resultView = newQualified;
                }
              }),
            );

            await get().db.refreshTableSchemas();
            const dagId = findDagIdByNodeId(get().canvas.config, nodeId);
            if (dagId) {
              await get().dag.runDownstreamCascade(dagId, nodeId);
            }
          },

          deleteNode: (nodeId: string) => {
            const current = get();
            const cell = current.cells.data[nodeId];
            let tableToDrop: string | undefined;
            if (cell && cell.type === 'sql') {
              const title = cell.data.title || 'result';
              const status = current.cells.status[nodeId];
              tableToDrop =
                status?.type === 'sql' && status.status === 'success'
                  ? status.resultName
                  : `${CANVAS_SCHEMA_NAME}.${escapeId(title)}`;
            }

            get().cells.removeCell(nodeId);
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const dagId = findDagIdByNodeId(draft.canvas.config, nodeId);
                if (!dagId) return;
                const d = getDag(draft.canvas.config, dagId);
                if (!d) return;
                delete d.cells[nodeId];
                d.meta.nodeOrder = d.meta.nodeOrder.filter(
                  (id) => id !== nodeId,
                );
                d.meta.edges = d.meta.edges.filter(
                  (e) => e.source !== nodeId && e.target !== nodeId,
                );
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
                  console.warn('[canvas.deleteNode] Failed to drop table', e);
                }
              })();
            }
          },

          applyNodeChanges: (changes: NodeChange<CanvasNode>[]) => {
            set((state: CanvasRootState) =>
              produce(state, (draft: CanvasRootState) => {
                const {dag} = ensureDagExists(draft.canvas.config);
                const updated = applyNodeChanges(changes, dagNodesArray(dag));
                dag.cells = updated.reduce<Record<string, CanvasNode>>(
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

          applyEdgeChanges: (changes: EdgeChange<CanvasEdge>[]) => {
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
            await get().cells.runCell(nodeId, {
              ...opts,
              schemaName: CANVAS_SCHEMA_NAME,
            });
          },
        },
      };
    },
  );
}

export type DuckDbSliceStateWithCanvas = DuckDbSliceState &
  CanvasSliceState &
  DagSliceState &
  CellsRootState;

export function useStoreWithCanvas<T>(
  selector: (state: DuckDbSliceStateWithCanvas) => T,
): T {
  return useBaseRoomStore<BaseRoomStoreState, T>((state) =>
    selector(state as unknown as DuckDbSliceStateWithCanvas),
  );
}
