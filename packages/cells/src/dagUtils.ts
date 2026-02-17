import type {
  Cell,
  CellsRootState,
  Edge,
  EdgeKind,
  Sheet,
  SheetGraphCache,
  SqlSelectToJsonFn,
} from './types';

export type DependencyGraph = {
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
};

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getEdgeKind(edge: Edge): EdgeKind {
  return edge.kind ?? 'dependency';
}

function isGraphCacheComplete(
  cache: SheetGraphCache | undefined,
  sheet: Sheet,
): boolean {
  if (!cache) return false;
  return sheet.cellIds.every((cellId) =>
    Array.isArray(cache.dependencies[cellId]),
  );
}

export function buildGraphCacheFromEdges(sheet: Sheet): SheetGraphCache {
  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  const localCellIds = new Set(sheet.cellIds);

  for (const cellId of sheet.cellIds) {
    dependencies[cellId] = [];
  }

  for (const edge of sheet.edges) {
    // Cascades only consume dependency edges.
    if (getEdgeKind(edge) !== 'dependency') continue;
    if (!localCellIds.has(edge.source) || !localCellIds.has(edge.target))
      continue;

    const deps = dependencies[edge.target] || (dependencies[edge.target] = []);
    if (!deps.includes(edge.source)) deps.push(edge.source);

    const children = dependents[edge.source] || (dependents[edge.source] = []);
    if (!children.includes(edge.target)) children.push(edge.target);
  }

  return {
    dependencies,
    dependents,
    contentHashByCell: sheet.graphCache?.contentHashByCell || {},
  };
}

export function dependencyEdgesFromGraphCache(sheet: Sheet): Edge[] {
  if (!isGraphCacheComplete(sheet.graphCache, sheet)) return [];

  const cache = sheet.graphCache as SheetGraphCache;
  const localCellIds = new Set(sheet.cellIds);
  const edges: Edge[] = [];

  for (const target of sheet.cellIds) {
    const deps = dedupe(cache.dependencies[target] || []);
    for (const source of deps) {
      if (!localCellIds.has(source) || source === target) continue;
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        kind: 'dependency',
      });
    }
  }

  return edges;
}

export function getRenderableDependencyEdges(sheet: Sheet): Edge[] {
  const cacheEdges = dependencyEdgesFromGraphCache(sheet);
  if (cacheEdges.length > 0 || isGraphCacheComplete(sheet.graphCache, sheet)) {
    return cacheEdges;
  }

  // Compatibility fallback while legacy edge persistence still exists.
  // TODO(edge-kinds): merge sheet-local manual edges here once manual editing is enabled.
  return sheet.edges.filter((edge) => getEdgeKind(edge) === 'dependency');
}

export function ensureGraphCache(sheet: Sheet): SheetGraphCache {
  if (!sheet.graphCache || !isGraphCacheComplete(sheet.graphCache, sheet)) {
    sheet.graphCache = buildGraphCacheFromEdges(sheet);
  }
  return sheet.graphCache;
}

export function replaceCellDependenciesInCache(
  sheet: Sheet,
  cellId: string,
  deps: string[],
) {
  const cache = ensureGraphCache(sheet);
  const localCellIds = new Set(sheet.cellIds);
  const nextDeps = dedupe(deps).filter(
    (depId) => localCellIds.has(depId) && depId !== cellId,
  );
  const previousDeps = cache.dependencies[cellId] || [];

  for (const oldDep of previousDeps) {
    if (nextDeps.includes(oldDep)) continue;
    const currentDependents = cache.dependents[oldDep] || [];
    cache.dependents[oldDep] = currentDependents.filter((id) => id !== cellId);
  }

  cache.dependencies[cellId] = nextDeps;

  for (const depId of nextDeps) {
    const children = cache.dependents[depId] || (cache.dependents[depId] = []);
    if (!children.includes(cellId)) children.push(cellId);
  }
}

export function removeCellFromCache(sheet: Sheet, cellId: string) {
  const cache = ensureGraphCache(sheet);
  const previousDeps = cache.dependencies[cellId] || [];

  for (const depId of previousDeps) {
    const children = cache.dependents[depId] || [];
    cache.dependents[depId] = children.filter((id) => id !== cellId);
  }

  const downstream = cache.dependents[cellId] || [];
  for (const dependentId of downstream) {
    const deps = cache.dependencies[dependentId] || [];
    cache.dependencies[dependentId] = deps.filter((id) => id !== cellId);
  }

  delete cache.dependencies[cellId];
  delete cache.dependents[cellId];
  if (cache.contentHashByCell) {
    delete cache.contentHashByCell[cellId];
  }
}

export function buildDependencyGraph(
  sheetId: string,
  state: CellsRootState,
): DependencyGraph {
  const sheet = state.cells.config.sheets[sheetId];
  if (!sheet) return {dependencies: {}, dependents: {}};

  const cache = isGraphCacheComplete(sheet.graphCache, sheet)
    ? (sheet.graphCache as SheetGraphCache)
    : buildGraphCacheFromEdges(sheet);

  return {
    dependencies: {...cache.dependencies},
    dependents: {...cache.dependents},
  };
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
 * Async version of dependency graph build that always uses AST-enabled
 * registry dependency derivation.
 */
export async function buildDependencyGraphAsync(
  sheetId: string,
  state: CellsRootState,
  sqlSelectToJson: SqlSelectToJsonFn,
): Promise<DependencyGraph> {
  const sheet = state.cells.config.sheets[sheetId];
  const registry = state.cells.cellRegistry;
  if (!sheet) {
    return {dependencies: {}, dependents: {}};
  }

  if (isGraphCacheComplete(sheet.graphCache, sheet)) {
    const cache = sheet.graphCache as SheetGraphCache;
    return {
      dependencies: {...cache.dependencies},
      dependents: {...cache.dependents},
    };
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

      const deps = await registryItem.findDependencies({
        cell,
        cells: scopedCells,
        sheetId,
        sqlSelectToJson,
      });

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
