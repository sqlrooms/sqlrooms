import type {Cell, CellsRootState} from './types';

export type DependencyGraph = {
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
};

export function buildDependencyGraph(
  sheetId: string,
  state: CellsRootState,
): DependencyGraph {
  const sheet = state.cells.config.sheets[sheetId];
  const registry = state.cells.cellRegistry;
  if (!sheet) {
    return {dependencies: {}, dependents: {}};
  }

  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};

  for (const cellId of sheet.cellIds) {
    const cell = state.cells.config.data[cellId];
    if (!cell) continue;

    const deps = Array.from(
      new Set(
        registry[cell.type]?.findDependencies({
          cell,
          cells: state.cells.config.data as Record<string, Cell>,
          sheetId,
        }) ?? [],
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

export function topologicalOrder(
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

export function collectReachable(
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
