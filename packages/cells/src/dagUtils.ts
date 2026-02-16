import type {Cell, CellsRootState, SqlSelectToJsonFn} from './types';

export type DependencyGraph = {
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
};

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

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
  const sheetCellIds = new Set(sheet.cellIds);
  const scopedCells = Object.fromEntries(
    sheet.cellIds
      .map((id) => state.cells.config.data[id])
      .filter(isDefined)
      .map((cell) => [cell.id, cell]),
  ) as Record<string, Cell>;

  for (const cellId of sheet.cellIds) {
    const cell = state.cells.config.data[cellId];
    if (!cell) continue;

    const deps = Array.from(
      new Set(
        registry[cell.type]?.findDependencies({
          cell,
          cells: scopedCells,
          sheetId,
        }) ?? [],
      ),
    ).filter((depId) => sheetCellIds.has(depId));
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

/**
 * Async version of buildDependencyGraph that uses findDependenciesAsync when available.
 */
export async function buildDependencyGraphAsync(
  sheetId: string,
  state: CellsRootState,
  sqlSelectToJson?: SqlSelectToJsonFn,
): Promise<DependencyGraph> {
  const sheet = state.cells.config.sheets[sheetId];
  const registry = state.cells.cellRegistry;
  if (!sheet) {
    return {dependencies: {}, dependents: {}};
  }

  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  const sheetCellIds = new Set(sheet.cellIds);
  const scopedCells = Object.fromEntries(
    sheet.cellIds
      .map((id) => state.cells.config.data[id])
      .filter(isDefined)
      .map((cell) => [cell.id, cell]),
  ) as Record<string, Cell>;

  // Process all cells in parallel
  const cellDeps = await Promise.all(
    sheet.cellIds.map(async (cellId) => {
      const cell = state.cells.config.data[cellId];
      if (!cell) return {cellId, deps: []};

      const registryItem = registry[cell.type];
      if (!registryItem) return {cellId, deps: []};

      let deps: string[];
      if (registryItem.findDependenciesAsync && sqlSelectToJson) {
        deps = await registryItem.findDependenciesAsync({
          cell,
          cells: scopedCells,
          sheetId,
          sqlSelectToJson,
        });
      } else {
        deps = registryItem.findDependencies({
          cell,
          cells: scopedCells,
          sheetId,
        });
      }

      return {
        cellId,
        deps: Array.from(new Set(deps)).filter((depId) =>
          sheetCellIds.has(depId),
        ),
      };
    }),
  );

  // Build the graph from results
  for (const {cellId, deps} of cellDeps) {
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
