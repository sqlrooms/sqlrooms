import type {StateCreator} from '@sqlrooms/room-store';

export type DagDefinition<TCell, TMeta = unknown> = {
  id: string;
  cells: Record<string, TCell>;
  meta: TMeta;
};

export type DagConfig<TCell, TMeta = unknown> = {
  dags: Record<string, DagDefinition<TCell, TMeta>>;
  dagOrder: string[];
  currentDagId?: string;
};

export type DagSliceState = {
  dag: {
    /**
     * Return downstream cell ids reachable from the given source cell,
     * in a topological order where parents appear before their children.
     */
    getDownstream: (dagId: string, sourceCellId: string) => string[];
    /**
     * Get cells that have no dependencies in the given DAG.
     */
    getRootCells: (dagId: string) => string[];
    /**
     * Execute all cells in a DAG in dependency order (roots first).
     */
    runAllCellsCascade: (dagId: string) => Promise<void>;
    /**
     * Execute downstream cells reachable from a given source cell.
     */
    runDownstreamCascade: (
      dagId: string,
      sourceCellId: string,
    ) => Promise<void>;
  };
};

export type DagSliceOptions<TRootState, TCell, TMeta> = {
  /**
   * Selector to obtain the DagConfig from the root store state.
   */
  getDagConfig: (state: TRootState) => DagConfig<TCell, TMeta> | undefined;
  /**
   * Find dependencies for a cell. Should return upstream cell ids that the
   * provided cell depends on.
   */
  findDependencies: (args: {
    dagId: string;
    cellId: string;
    cell: TCell;
    cells: Record<string, TCell>;
    getState: () => TRootState;
  }) => string[];
  /**
   * Run a single cell. The slice will call this in topological order with
   * cascade disabled; the caller may still choose to cascade internally.
   */
  runCell: (args: {
    dagId: string;
    cellId: string;
    cascade?: boolean;
    getState: () => TRootState;
  }) => Promise<void>;
};

type DependencyGraph = {
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
};

function buildDependencyGraph<TRootState, TCell, TMeta>(
  dagId: string,
  getState: () => TRootState,
  options: DagSliceOptions<TRootState, TCell, TMeta>,
): DependencyGraph {
  const config = options.getDagConfig(getState());
  const dag = config?.dags?.[dagId];
  if (!dag) {
    return {dependencies: {}, dependents: {}};
  }

  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  for (const [cellId, cell] of Object.entries(dag.cells)) {
    const deps = Array.from(
      new Set(
        options.findDependencies({
          dagId,
          cellId,
          cell,
          cells: dag.cells,
          getState,
        }),
      ),
    );
    dependencies[cellId] = deps;
    for (const dep of deps) {
      const list = dependents[dep] || (dependents[dep] = []);
      if (!list.includes(cellId)) {
        list.push(cellId);
      }
    }
  }
  return {dependencies, dependents};
}

function topologicalOrder(
  roots: string[],
  dependencies: Record<string, string[]>,
  dependents: Record<string, string[]>,
  scope?: Set<string>,
): string[] {
  const inDegree: Record<string, number> = {};
  const queue: string[] = [];

  const addNode = (id: string) => {
    if (scope && !scope.has(id)) return;
    if (!(id in inDegree)) inDegree[id] = 0;
  };

  // Initialize in-degree using dependencies map
  for (const [cellId, deps] of Object.entries(dependencies)) {
    addNode(cellId);
    if (scope && !scope.has(cellId)) continue;
    for (const dep of deps) {
      if (scope && !scope.has(dep)) continue;
      inDegree[cellId] = (inDegree[cellId] ?? 0) + 1;
      addNode(dep);
    }
  }

  for (const root of roots) {
    if (scope && !scope.has(root)) continue;
    queue.push(root);
  }

  const order: string[] = [];
  while (queue.length) {
    const current = queue.shift() as string;
    if (scope && !scope.has(current)) continue;
    order.push(current);
    for (const child of dependents[current] || []) {
      if (scope && !scope.has(child)) continue;
      inDegree[child] = (inDegree[child] ?? 0) - 1;
      if (inDegree[child] === 0) queue.push(child);
    }
  }
  return order;
}

function collectReachable(
  startId: string,
  dependents: Record<string, string[]>,
): Set<string> {
  const reachable = new Set<string>();
  const queue = [...(dependents[startId] || [])];
  while (queue.length) {
    const next = queue.shift() as string;
    if (reachable.has(next)) continue;
    reachable.add(next);
    for (const child of dependents[next] || []) {
      queue.push(child);
    }
  }
  return reachable;
}

export function createDagSlice<TRootState, TCell, TMeta>(
  options: DagSliceOptions<TRootState, TCell, TMeta>,
): StateCreator<TRootState & DagSliceState> {
  return (_set, get) =>
    ({
      dag: {
        getRootCells: (dagId: string) => {
          const {dependencies} = buildDependencyGraph(dagId, get, options);
          const ids = Object.keys(dependencies);
          return ids.filter((id) => (dependencies[id]?.length ?? 0) === 0);
        },

        getDownstream: (dagId: string, sourceCellId: string) => {
          const {dependencies, dependents} = buildDependencyGraph(
            dagId,
            get,
            options,
          );
          const reachable = collectReachable(sourceCellId, dependents);
          if (!reachable.size) return [];
          // Exclude the source id from the reachable set to avoid re-running it
          reachable.delete(sourceCellId);
          const rootsWithinScope = Array.from(reachable).filter((id) => {
            const deps = dependencies[id] || [];
            return deps.filter((d) => reachable.has(d)).length === 0;
          });
          return topologicalOrder(
            rootsWithinScope,
            dependencies,
            dependents,
            reachable,
          );
        },

        runAllCellsCascade: async (dagId: string) => {
          const {dependencies, dependents} = buildDependencyGraph(
            dagId,
            get,
            options,
          );
          const roots = Object.keys(dependencies).filter(
            (id) => (dependencies[id]?.length ?? 0) === 0,
          );
          const order = topologicalOrder(roots, dependencies, dependents);
          for (const cellId of order) {
            await options.runCell({
              dagId,
              cellId,
              cascade: false,
              getState: get,
            });
          }
        },

        runDownstreamCascade: async (dagId: string, sourceCellId: string) => {
          const {dependencies, dependents} = buildDependencyGraph(
            dagId,
            get,
            options,
          );
          const reachable = collectReachable(sourceCellId, dependents);
          if (!reachable.size) return;
          reachable.delete(sourceCellId);
          const rootsWithinScope = Array.from(reachable).filter((id) => {
            const deps = dependencies[id] || [];
            return deps.filter((d) => reachable.has(d)).length === 0;
          });
          const order = topologicalOrder(
            rootsWithinScope,
            dependencies,
            dependents,
            reachable,
          );
          for (const cellId of order) {
            await options.runCell({
              dagId,
              cellId,
              cascade: false,
              getState: get,
            });
          }
        },
      },
    }) as unknown as TRootState & DagSliceState;
}
