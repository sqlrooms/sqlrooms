/** A minimal graph node with an `id`. */
export type DagNode = {id: string};
/** A directed edge from `source` to `target`. */
export type DagEdge = {source: string; target: string};
/** Forward adjacency list mapping node id to its child node ids. */
export type Adjacency = Record<string, string[]>;

/**
 * Build a forward adjacency list for a directed graph.
 * Ensures that every node id exists in the adjacency map, even if it has no outgoing edges.
 *
 * @param nodes - The set of nodes to include in the graph.
 * @param edges - Directed edges where `source` points to `target`.
 * @returns A mapping from node id to an array of child node ids.
 */
export function buildAdjacency(nodes: DagNode[], edges: DagEdge[]): Adjacency {
  const adjacency: Adjacency = {};
  for (const n of nodes) adjacency[n.id] = [];
  for (const e of edges) {
    const list = adjacency[e.source] || (adjacency[e.source] = []);
    list.push(e.target);
  }
  return adjacency;
}

/**
 * Topologically sort all nodes in the graph using Kahn's algorithm.
 * If a cycle is detected, the remaining nodes are appended in arbitrary order,
 * and a warning is logged.
 *
 * @param nodes - The set of nodes to sort.
 * @param edges - Directed edges defining dependencies.
 * @returns An array of node ids in dependency order (parents before children).
 */
export function topoSortAll(nodes: DagNode[], edges: DagEdge[]): string[] {
  const adjacency = buildAdjacency(nodes, edges);
  const inDegree: Record<string, number> = {};
  for (const n of nodes) inDegree[n.id] = 0;
  for (const e of edges) {
    inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;
  }

  const queue: string[] = Object.keys(inDegree).filter(
    (id) => (inDegree[id] ?? 0) === 0,
  );
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift() as string;
    order.push(cur);
    const neighbors = adjacency[cur] || [];
    for (const nb of neighbors) {
      inDegree[nb] = (inDegree[nb] ?? 0) - 1;
      if (inDegree[nb] === 0) queue.push(nb);
    }
  }

  if (order.length < nodes.length) {
    const remaining = nodes
      .map((n) => n.id)
      .filter((id) => !order.includes(id));
    // eslint-disable-next-line no-console
    console.warn(
      '[dag.topoSortAll] Cycle detected; appending remaining nodes arbitrarily:',
      remaining,
    );
    order.push(...remaining);
  }
  return order;
}

/**
 * Get a topological order for the downstream subgraph reachable from `startId`.
 * Only nodes reachable from the start are included (the starting node is excluded).
 * If a cycle exists within the reachable subgraph, the remaining nodes are appended
 * at the end in arbitrary order and a warning is logged.
 *
 * @param startId - The node id to start traversal from.
 * @param nodes - The set of nodes in the full graph.
 * @param edges - Directed edges defining the full graph dependencies.
 * @returns Node ids reachable from `startId`, in dependency order.
 */
export function topoSortDownstream(
  startId: string,
  nodes: DagNode[],
  edges: DagEdge[],
): string[] {
  const adjacency = buildAdjacency(nodes, edges);
  // Collect reachable nodes from startId (excluding start)
  const reachable = new Set<string>();
  const queue: string[] = [...(adjacency[startId] || [])];
  while (queue.length) {
    const cur = queue.shift() as string;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const neighbors = adjacency[cur] || [];
    for (const nb of neighbors) queue.push(nb);
  }
  if (reachable.size === 0) return [];

  // Kahn's algorithm for topological sort within subgraph
  const inDegree: Record<string, number> = {};
  for (const id of reachable) inDegree[id] = 0;
  for (const e of edges) {
    if (reachable.has(e.source) && reachable.has(e.target)) {
      inDegree[e.target] = (inDegree[e.target] ?? 0) + 1;
    }
  }
  const queue2: string[] = Array.from(reachable).filter(
    (id) => (inDegree[id] ?? 0) === 0,
  );
  const order: string[] = [];
  while (queue2.length) {
    const cur = queue2.shift() as string;
    order.push(cur);
    const neighbors = adjacency[cur] || [];
    for (const nb of neighbors) {
      if (!reachable.has(nb)) continue;
      inDegree[nb] = (inDegree[nb] ?? 0) - 1;
      if (inDegree[nb] === 0) queue2.push(nb);
    }
  }
  if (order.length < reachable.size) {
    const remaining = Array.from(reachable).filter((id) => !order.includes(id));
    // eslint-disable-next-line no-console
    console.warn(
      '[dag.topoSortDownstream] Cycle detected in downstream graph:',
      remaining,
    );
    order.push(...remaining);
  }
  return order;
}
