import type {
  Cell,
  CellDependencies,
  CellsRootState,
  CellArtifactRuntime,
  CellArtifactGraphCache,
  Edge,
  EdgeKind,
  SqlSelectToJsonFn,
} from './types';
import {isDefined} from './utils';
import {normalizeCellDependencies} from './helpers';

export type DependencyGraph = {
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
  tableDependencies?: Record<string, string[]>;
};

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getEdgeKind(edge: Edge): EdgeKind {
  return edge.kind ?? 'dependency';
}

function isGraphCacheComplete(
  cache: CellArtifactGraphCache | undefined,
  artifact: CellArtifactRuntime,
): boolean {
  if (!cache) return false;
  return artifact.cellIds.every((cellId) =>
    Array.isArray(cache.dependencies[cellId]),
  );
}

export function buildGraphCacheFromEdges(
  artifact: CellArtifactRuntime,
): CellArtifactGraphCache {
  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  const localCellIds = new Set(artifact.cellIds);

  for (const cellId of artifact.cellIds) {
    dependencies[cellId] = [];
  }

  for (const edge of artifact.edges) {
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
    contentHashByCell: artifact.graphCache?.contentHashByCell || {},
    tableDependencies: artifact.graphCache?.tableDependencies || {},
  };
}

export function dependencyEdgesFromGraphCache(
  artifact: CellArtifactRuntime,
): Edge[] {
  if (!isGraphCacheComplete(artifact.graphCache, artifact)) return [];

  const cache = artifact.graphCache as CellArtifactGraphCache;
  const localCellIds = new Set(artifact.cellIds);
  const edges: Edge[] = [];

  for (const target of artifact.cellIds) {
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

export function getRenderableDependencyEdges(
  artifact: CellArtifactRuntime,
): Edge[] {
  const cacheEdges = dependencyEdgesFromGraphCache(artifact);
  if (
    cacheEdges.length > 0 ||
    isGraphCacheComplete(artifact.graphCache, artifact)
  ) {
    return cacheEdges;
  }

  // Compatibility fallback while legacy edge persistence still exists.
  // TODO(edge-kinds): merge sheet-local manual edges here once manual editing is enabled.
  return artifact.edges.filter((edge) => getEdgeKind(edge) === 'dependency');
}

export function ensureGraphCache(
  artifact: CellArtifactRuntime,
): CellArtifactGraphCache {
  if (
    !artifact.graphCache ||
    !isGraphCacheComplete(artifact.graphCache, artifact)
  ) {
    artifact.graphCache = buildGraphCacheFromEdges(artifact);
  }
  return artifact.graphCache;
}

export function replaceCellDependenciesInCache(
  artifact: CellArtifactRuntime,
  cellId: string,
  deps: string[],
  tableNames?: string[],
) {
  const cache = ensureGraphCache(artifact);
  const localCellIds = new Set(artifact.cellIds);
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

  if (tableNames !== undefined) {
    cache.tableDependencies = cache.tableDependencies || {};
    cache.tableDependencies[cellId] = tableNames;
  }
}

export function removeCellFromCache(
  artifact: CellArtifactRuntime,
  cellId: string,
) {
  const cache = ensureGraphCache(artifact);
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
  if (cache.tableDependencies) {
    delete cache.tableDependencies[cellId];
  }
}

export function buildDependencyGraph(
  artifactId: string,
  state: CellsRootState,
): DependencyGraph {
  const artifact = state.cells.config.artifacts[artifactId];
  if (!artifact) return {dependencies: {}, dependents: {}};

  const cache = isGraphCacheComplete(artifact.graphCache, artifact)
    ? (artifact.graphCache as CellArtifactGraphCache)
    : buildGraphCacheFromEdges(artifact);

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
  artifactId: string,
  state: CellsRootState,
  sqlSelectToJson: SqlSelectToJsonFn,
): Promise<DependencyGraph> {
  const artifact = state.cells.config.artifacts[artifactId];
  const registry = state.cells.cellRegistry;
  if (!artifact) {
    return {dependencies: {}, dependents: {}};
  }

  if (isGraphCacheComplete(artifact.graphCache, artifact)) {
    const cache = artifact.graphCache as CellArtifactGraphCache;
    return {
      dependencies: {...cache.dependencies},
      dependents: {...cache.dependents},
      tableDependencies: cache.tableDependencies
        ? {...cache.tableDependencies}
        : undefined,
    };
  }

  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  const tableDependencies: Record<string, string[]> = {};
  const artifactCellIds = new Set(artifact.cellIds);
  const scopedCells = Object.fromEntries(
    artifact.cellIds
      .map((id) => state.cells.config.data[id])
      .filter(isDefined)
      .map((cell) => [cell.id, cell]),
  ) as Record<string, Cell>;

  const cellDeps = await Promise.all(
    artifact.cellIds.map(async (cellId) => {
      const cell = state.cells.config.data[cellId];
      if (!cell)
        return {
          cellId,
          cellIds: [] as string[],
          tableNames: undefined as string[] | undefined,
        };

      const registryItem = registry[cell.type];
      if (!registryItem)
        return {
          cellId,
          cellIds: [] as string[],
          tableNames: undefined as string[] | undefined,
        };

      const raw = await registryItem.findDependencies({
        cell,
        cells: scopedCells,
        artifactId,
        sqlSelectToJson,
      });
      const normalized = normalizeCellDependencies(raw);

      return {
        cellId,
        cellIds: Array.from(new Set(normalized.cellIds)).filter((depId) =>
          artifactCellIds.has(depId),
        ),
        tableNames: normalized.tableNames,
      };
    }),
  );

  for (const {cellId, cellIds, tableNames} of cellDeps) {
    dependencies[cellId] = cellIds;
    for (const dep of cellIds) {
      const list = dependents[dep] || (dependents[dep] = []);
      if (!list.includes(cellId)) {
        list.push(cellId);
      }
    }
    if (tableNames && tableNames.length > 0) {
      tableDependencies[cellId] = tableNames;
    }
  }

  return {dependencies, dependents, tableDependencies};
}
